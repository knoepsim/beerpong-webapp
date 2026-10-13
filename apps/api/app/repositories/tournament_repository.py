from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.tournament import Tournament, TournamentVisibility
from app.models.tournament_role import TournamentRoleType, TournamentUserRole
from app.repositories.base import BaseRepository


class TournamentRepository(BaseRepository[Tournament]):
    def __init__(self):
        super().__init__(Tournament)

    async def get_with_relations(self, db: AsyncSession, id: UUID) -> Tournament | None:
        stmt = (
            select(Tournament)
            .where(Tournament.id == id, Tournament.is_deleted == False)
            .options(
                selectinload(Tournament.teams),
                selectinload(Tournament.matches),
                selectinload(Tournament.roles),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_visible_for_user(self, db: AsyncSession, user_id: UUID) -> list[Tournament]:
        # Public listed tournaments
        public_q = select(Tournament).where(
            Tournament.visibility == TournamentVisibility.PUBLIC_LISTED,
            Tournament.is_deleted == False,
        )

        # Tournaments user is part of (as a player in a team)
        from app.models.team import Team, TeamMember
        from app.models.tournament import TournamentTeam
        player_q = (
            select(Tournament)
            .join(TournamentTeam, Tournament.id == TournamentTeam.tournament_id)
            .join(Team, TournamentTeam.team_id == Team.id)
            .join(TeamMember, Team.id == TeamMember.team_id)
            .where(TeamMember.user_id == user_id, Tournament.is_deleted == False)
        )

        # Tournaments user manages
        manager_q = (
            select(Tournament)
            .join(TournamentUserRole, Tournament.id == TournamentUserRole.tournament_id)
            .where(TournamentUserRole.user_id == user_id, Tournament.is_deleted == False)
        )

        # Execute queries and combine results uniquely
        public_res = await db.execute(public_q)
        player_res = await db.execute(player_q)
        manager_res = await db.execute(manager_q)

        all_tournaments = set(public_res.scalars()) | set(player_res.scalars()) | set(manager_res.scalars())
        return list(all_tournaments)

    async def get_my_tournaments(self, db: AsyncSession, user_id: UUID):
        # Participating tournaments
        from app.models.team import Team, TeamMember
        from app.models.tournament import TournamentTeam
        participating_q = (
            select(Tournament, Team)
            .join(TournamentTeam, Tournament.id == TournamentTeam.tournament_id)
            .join(Team, TournamentTeam.team_id == Team.id)
            .join(TeamMember, Team.id == TeamMember.team_id)
            .where(TeamMember.user_id == user_id, Tournament.is_deleted == False)
        )
        
        # Managing tournaments
        managing_q = (
            select(Tournament, TournamentUserRole.role)
            .join(TournamentUserRole, Tournament.id == TournamentUserRole.tournament_id)
            .where(
                TournamentUserRole.user_id == user_id,
                TournamentUserRole.role.in_([TournamentRoleType.ADMIN, TournamentRoleType.MANAGER]),
                Tournament.is_deleted == False,
            )
        )
        
        participating_res = await db.execute(participating_q)
        managing_res = await db.execute(managing_q)
        
        return participating_res.all(), managing_res.all()

tournament_repository = TournamentRepository()
