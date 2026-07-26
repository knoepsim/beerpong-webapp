from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.exceptions import (
    NotFoundError,
    PlayerAlreadyInTournamentError,
    TeamNotCompleteError,
    TournamentDeletedError,
)
from app.models.team import Team, TeamMember
from app.models.tournament import Tournament, TournamentTeam
from app.models.tournament_role import TournamentRoleType, TournamentUserRole
from app.repositories.tournament_repository import tournament_repository
from app.schemas.tournament import TournamentCreate, TournamentUpdate
from app.services import team_service


async def create_tournament(db: AsyncSession, data: TournamentCreate, creator_id: UUID) -> Tournament:
    """Create a new tournament and assign the creator as Admin."""
    obj_in = data.model_dump()
    obj_in["created_by_id"] = creator_id
    tournament = await tournament_repository.create(db, obj_in=obj_in)
    await db.flush()

    # Assign Admin role to the creator
    admin_role = TournamentUserRole(
        tournament_id=tournament.id,
        user_id=creator_id,
        role=TournamentRoleType.ADMIN,
    )
    db.add(admin_role)

    return tournament


async def get_tournament(db: AsyncSession, tournament_id: UUID) -> Tournament:
    """Get a tournament by ID. Raises NotFoundError for missing or deleted tournaments."""
    tournament = await tournament_repository.get_by_id(db, tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament")
    if tournament.is_deleted:
        raise TournamentDeletedError()
    return tournament


async def update_tournament(db: AsyncSession, tournament_id: UUID, data: TournamentUpdate) -> Tournament:
    """Update tournament details cleanly."""
    tournament = await get_tournament(db, tournament_id)
    
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        return tournament
        
    return await tournament_repository.update(db, db_obj=tournament, obj_in=update_data)


async def delete_tournament(db: AsyncSession, tournament_id: UUID) -> None:
    """Soft delete a tournament."""
    tournament = await get_tournament(db, tournament_id)
    await tournament_repository.update(db, db_obj=tournament, obj_in={"is_deleted": True})


async def list_tournaments(db: AsyncSession, user_id: UUID) -> list[Tournament]:
    """List all visible tournaments."""
    return await tournament_repository.list_visible_for_user(db, user_id)


async def get_my_tournaments(db: AsyncSession, user_id: UUID) -> dict:
    """Get customized tournament groupings for the user."""
    participating_res, managing_res = await tournament_repository.get_my_tournaments(db, user_id)
    
    participating = []
    for tournament, team in participating_res:
        participating.append({
            "tournament": tournament,
            "team": team
        })

    managing = []
    for tournament, role in managing_res:
        managing.append({
            "tournament": tournament,
            "role": role
        })

    return {
        "participating": participating,
        "managing": managing
    }

async def join_tournament(
    db: AsyncSession, tournament_id: UUID, team_id: UUID
) -> TournamentTeam:
    """Join a tournament with a team. Implements the 5-step validation from requirements."""
    await get_tournament(db, tournament_id)

    team = await team_service.get_team(db, team_id)
    member_count = await team_service.get_team_member_count(db, team_id)
    if member_count < team.max_size:
        raise TeamNotCompleteError()

    team_members = await team_service.get_team_members(db, team_id)
    member_user_ids = [m.user_id for m in team_members]

    for uid in member_user_ids:
        existing = await db.execute(
            select(TournamentTeam)
            .join(TeamMember, TeamMember.team_id == TournamentTeam.team_id)
            .where(
                TournamentTeam.tournament_id == tournament_id,
                TeamMember.user_id == uid,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise PlayerAlreadyInTournamentError()

    entry = TournamentTeam(tournament_id=tournament_id, team_id=team_id)
    db.add(entry)
    return entry


async def get_tournament_teams(db: AsyncSession, tournament_id: UUID) -> list[Team]:
    """Get all teams participating in a tournament."""
    result = await db.execute(
        select(Team)
        .join(TournamentTeam, TournamentTeam.team_id == Team.id)
        .where(TournamentTeam.tournament_id == tournament_id)
    )
    return list(result.scalars().all())


async def leave_tournament(db: AsyncSession, tournament_id: UUID, user_id: UUID) -> None:
    """Withdraw a team from a tournament before it starts."""
    await get_tournament(db, tournament_id)
    
    team_q = (
        select(Team)
        .join(TournamentTeam, TournamentTeam.team_id == Team.id)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .where(
            TournamentTeam.tournament_id == tournament_id,
            TeamMember.user_id == user_id,
        )
    )
    result = await db.execute(team_q)
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=400, detail="User is not part of this tournament.")
        
    await db.execute(
        delete(TournamentTeam)
        .where(
        )
    )

async def remove_team(db: AsyncSession, tournament_id: UUID, team_id: UUID) -> None:
    """Remove a specific team from a tournament (Admin action)."""
    await get_tournament(db, tournament_id)
    result = await db.execute(
        delete(TournamentTeam)
        .where(
            TournamentTeam.tournament_id == tournament_id,
            TournamentTeam.team_id == team_id
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=400, detail="Team is not part of this tournament.")
