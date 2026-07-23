from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    NotFoundError,
    PlayerAlreadyInTournamentError,
    TeamNotCompleteError,
    TournamentDeletedError,
)
from app.models.team import TeamMember
from app.models.tournament import Tournament, TournamentTeam
from app.models.tournament_role import TournamentRoleType, TournamentUserRole
from app.schemas.tournament import TournamentCreate, TournamentUpdate
from app.services import team_service


async def create_tournament(db: AsyncSession, data: TournamentCreate, creator_id: UUID) -> Tournament:
    """Create a new tournament and assign the creator as Admin."""
    tournament = Tournament(
        name=data.name,
        location=data.location,
        description=data.description,
        start_time=data.start_time,
        table_count=data.table_count,
        mode=data.mode,
        visibility=data.visibility,
        created_by_id=creator_id,
    )
    db.add(tournament)
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
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise NotFoundError("Tournament")
    if tournament.is_deleted:
        raise TournamentDeletedError()
    return tournament


async def list_tournaments(db: AsyncSession, user_id: UUID) -> list[Tournament]:
    """List all visible tournaments: public_listed ones + any the user is involved in."""
    from app.models.tournament import TournamentVisibility

    # Public listed tournaments
    public_q = select(Tournament).where(
        Tournament.is_deleted == False,  # noqa: E712
        Tournament.visibility == TournamentVisibility.PUBLIC_LISTED,
    )

    # Tournaments where user has a role
    user_q = (
        select(Tournament)
        .join(TournamentUserRole, TournamentUserRole.tournament_id == Tournament.id)
        .where(
            Tournament.is_deleted == False,  # noqa: E712
            TournamentUserRole.user_id == user_id,
        )
    )

    # Tournaments where user's team is participating
    team_q = (
        select(Tournament)
        .join(TournamentTeam, TournamentTeam.tournament_id == Tournament.id)
        .join(TeamMember, TeamMember.team_id == TournamentTeam.team_id)
        .where(
            Tournament.is_deleted == False,  # noqa: E712
            TeamMember.user_id == user_id,
        )
    )

    from sqlalchemy import union
    # Union all three queries
    combined = union(public_q, user_q, team_q)
    result = await db.execute(select(Tournament).from_statement(combined))
    return list(result.scalars().all())


async def update_tournament(
    db: AsyncSession, tournament_id: UUID, data: TournamentUpdate
) -> Tournament:
    """Update tournament details."""
    tournament = await get_tournament(db, tournament_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tournament, field, value)

    await db.flush()
    return tournament


async def soft_delete_tournament(db: AsyncSession, tournament_id: UUID) -> None:
    """Soft-delete a tournament (only Admin can do this — checked in router)."""
    tournament = await get_tournament(db, tournament_id)
    tournament.is_deleted = True


async def join_tournament(
    db: AsyncSession, tournament_id: UUID, team_id: UUID
) -> TournamentTeam:
    """Join a tournament with a team. Implements the 5-step validation from requirements."""
    await get_tournament(db, tournament_id)  # Validates tournament exists and is not deleted

    # Step 2 is handled by the caller (user selects the team)

    # Step 3: Team must be complete
    team = await team_service.get_team(db, team_id)
    member_count = await team_service.get_team_member_count(db, team_id)
    if member_count < team.max_size:
        raise TeamNotCompleteError()

    # Step 4: No team member is already in this tournament with another team
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

    # Step 5: Add team to tournament
    entry = TournamentTeam(tournament_id=tournament_id, team_id=team_id)
    db.add(entry)
    return entry
