from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import secrets
import string

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
from app.services.team_service import TeamService
from fastapi import Depends
from typing import Annotated
from app.core.database import get_db


class TournamentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_tournament(self, data: TournamentCreate, creator_id: UUID) -> Tournament:
        """Create a new tournament and assign the creator as Admin."""
        obj_in = data.model_dump()
        obj_in["created_by_id"] = creator_id
        tournament = await tournament_repository.create(self.db, obj_in=obj_in)
        await self.db.flush()

        # Assign Admin role to the creator
        admin_role = TournamentUserRole(
            tournament_id=tournament.id,
            user_id=creator_id,
            role=TournamentRoleType.ADMIN,
        )
        self.db.add(admin_role)

        return tournament


    async def get_tournament(self, tournament_id: UUID) -> Tournament:
        """Get a tournament by ID. Raises NotFoundError for missing or deleted tournaments."""
        tournament = await tournament_repository.get_by_id(self.db, tournament_id)
        if tournament is None:
            raise NotFoundError("Tournament")
        if tournament.is_deleted:
            raise TournamentDeletedError()
        return tournament

    async def get_tournament_for_user(
        self, tournament_id: UUID, user_id: UUID, invite_token: str | None = None
    ) -> Tournament:
        """Get tournament with visibility checks."""
        tournament = await self.get_tournament(tournament_id)

        from app.models.tournament import TournamentVisibility
        if tournament.visibility != TournamentVisibility.PRIVATE:
            return tournament

        if invite_token and tournament.invite_token and invite_token == tournament.invite_token:
            return tournament

        role = await self.db.execute(
            select(TournamentUserRole).where(
                TournamentUserRole.tournament_id == tournament_id,
                TournamentUserRole.user_id == user_id
            )
        )
        if role.scalar_one_or_none():
            return tournament

        participant = await self.db.execute(
            select(TeamMember)
            .join(TournamentTeam, TournamentTeam.team_id == TeamMember.team_id)
            .where(
                TournamentTeam.tournament_id == tournament_id,
                TeamMember.user_id == user_id
            )
        )
        if participant.scalar_one_or_none():
            return tournament

        raise HTTPException(status_code=403, detail="You do not have access to this private tournament.")


    async def update_tournament(self, tournament_id: UUID, data: TournamentUpdate) -> Tournament:
        """Update tournament details cleanly."""
        tournament = await self.get_tournament(tournament_id)

        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return tournament

        return await tournament_repository.update(self.db, db_obj=tournament, obj_in=update_data)


    async def delete_tournament(self, tournament_id: UUID) -> None:
        """Soft delete a tournament."""
        tournament = await self.get_tournament(tournament_id)
        await tournament_repository.update(self.db, db_obj=tournament, obj_in={"is_deleted": True})


    async def list_tournaments(self, user_id: UUID) -> list[Tournament]:
        """List all visible tournaments."""
        return await tournament_repository.list_visible_for_user(self.db, user_id)


    async def get_my_tournaments(self, user_id: UUID) -> dict:
        """Get customized tournament groupings for the user."""
        participating_res, managing_res = await tournament_repository.get_my_tournaments(self.db, user_id)

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
        self, tournament_id: UUID, team_id: UUID, invite_token: str | None = None
    ) -> TournamentTeam:
        """Join a tournament with a team. Implements the 5-step validation from requirements."""
        tournament = await self.get_tournament(tournament_id)
        
        from app.models.tournament import TournamentVisibility
        if tournament.visibility == TournamentVisibility.PRIVATE:
            if not tournament.invite_token or invite_token != tournament.invite_token:
                raise HTTPException(status_code=403, detail="Invalid or missing invite token for private tournament.")

        team = await TeamService(self.db).get_team(team_id)
        member_count = await TeamService(self.db).get_team_member_count(team_id)
        if member_count < team.max_size:
            raise TeamNotCompleteError()

        team_members = await TeamService(self.db).get_team_members(team_id)
        member_user_ids = [m.user_id for m in team_members]

        for uid in member_user_ids:
            existing = await self.db.execute(
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
        self.db.add(entry)
        return entry


    async def get_tournament_teams(self, tournament_id: UUID) -> list[tuple[Team, bool]]:
        """Get all teams participating in a tournament along with their check-in status."""
        result = await self.db.execute(
            select(Team, TournamentTeam.is_checked_in)
            .join(TournamentTeam, TournamentTeam.team_id == Team.id)
            .where(TournamentTeam.tournament_id == tournament_id)
        )
        return list(result.all())

    async def generate_invite_token(self, tournament_id: UUID) -> str:
        """Generate a new invite token for a tournament."""
        tournament = await self.get_tournament(tournament_id)
        alphabet = string.ascii_letters + string.digits
        token = "".join(secrets.choice(alphabet) for _ in range(32))
        
        tournament.invite_token = token
        self.db.add(tournament)
        return token



    async def leave_tournament(self, tournament_id: UUID, user_id: UUID) -> None:
        """Withdraw a team from a tournament before it starts."""
        await self.get_tournament(tournament_id)

        team_q = (
            select(Team)
            .join(TournamentTeam, TournamentTeam.team_id == Team.id)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(
                TournamentTeam.tournament_id == tournament_id,
                TeamMember.user_id == user_id,
            )
        )
        result = await self.db.execute(team_q)
        team = result.scalar_one_or_none()

        if not team:
            raise HTTPException(status_code=400, detail="User is not part of this tournament.")

        await self.db.execute(
            delete(TournamentTeam)
            .where(
                TournamentTeam.tournament_id == tournament_id,
                TournamentTeam.team_id == team.id
            )
        )

    async def remove_team(self, tournament_id: UUID, team_id: UUID) -> None:
        """Remove a specific team from a tournament (Admin action)."""
        await self.get_tournament(tournament_id)
        result = await self.db.execute(
            delete(TournamentTeam)
            .where(
                TournamentTeam.tournament_id == tournament_id,
                TournamentTeam.team_id == team_id
            )
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=400, detail="Team is not part of this tournament.")



    async def start_tournament(self, tournament_id: UUID) -> None:
        from datetime import datetime, timezone
        from sqlalchemy import select
        from app.models.match import Match
        from fastapi import HTTPException
        
        tournament = await self.get_tournament(tournament_id)
        if tournament.started_at is not None:
            raise HTTPException(status_code=400, detail="Tournament is already started.")
            
        res = await self.db.execute(select(Match).where(Match.tournament_id == tournament_id))
        if not res.scalars().first():
            raise HTTPException(status_code=400, detail="Cannot start tournament without a bracket.")
            
        tournament.started_at = datetime.now(timezone.utc)

    async def checkin_team(self, tournament_id: UUID, team_id: UUID, is_checked_in: bool) -> None:
        """Update check-in status for a team in a tournament."""
        await self.get_tournament(tournament_id)
        
        result = await self.db.execute(
            select(TournamentTeam)
            .where(
                TournamentTeam.tournament_id == tournament_id,
                TournamentTeam.team_id == team_id
            )
        )
        tournament_team = result.scalar_one_or_none()
        
        if not tournament_team:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Team is not in this tournament.")
            
        tournament_team.is_checked_in = is_checked_in


def get_tournament_service(db: Annotated[AsyncSession, Depends(get_db)]) -> TournamentService:
    return TournamentService(db)

