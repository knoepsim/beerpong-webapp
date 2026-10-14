from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tournament import Tournament, TournamentVisibility
from app.models.tournament_role import TournamentRoleType, TournamentUserRole
from app.repositories.base import BaseRepository


class TournamentRepository(BaseRepository[Tournament]):
    def __init__(self):
        super().__init__(Tournament)

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
