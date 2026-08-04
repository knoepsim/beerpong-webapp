from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team import Team, TeamMember
from app.models.tournament import TournamentTeam
from app.models.match import Match
from app.models.result import Result
from app.models.user import User
from app.repositories.base import BaseRepository


class TeamRepository(BaseRepository[Team]):
    def __init__(self):
        super().__init__(Team)

    async def get_by_id_active(self, db: AsyncSession, id: UUID) -> Team | None:
        result = await db.execute(select(Team).where(Team.id == id, Team.is_deleted == False))
        return result.scalar_one_or_none()

    async def get_user_teams(self, db: AsyncSession, user_id: UUID) -> list[Team]:
        result = await db.execute(
            select(Team)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(TeamMember.user_id == user_id, Team.is_deleted == False)
        )
        return list(result.scalars().all())

    async def get_team_members(self, db: AsyncSession, team_id: UUID) -> list[TeamMember]:
        result = await db.execute(select(TeamMember).where(TeamMember.team_id == team_id))
        return list(result.scalars().all())

    async def get_team_members_with_names(self, db: AsyncSession, team_id: UUID) -> list[dict]:
        result = await db.execute(
            select(TeamMember, User.name)
            .join(User, User.id == TeamMember.user_id)
            .where(TeamMember.team_id == team_id)
        )
        rows = result.all()
        return [
            {
                "user_id": member.user_id,
                "joined_at": member.joined_at,
                "name": name,
            }
            for member, name in rows
        ]

    async def get_team_member_count(self, db: AsyncSession, team_id: UUID) -> int:
        result = await db.execute(
            select(func.count()).select_from(TeamMember).where(TeamMember.team_id == team_id)
        )
        return result.scalar_one()

    async def get_team_flags(self, db: AsyncSession, team_id: UUID) -> tuple[bool, bool]:
        result = await db.execute(
            select(TournamentTeam.tournament_id).where(TournamentTeam.team_id == team_id)
        )
        tournament_ids = result.scalars().all()

        if not tournament_ids:
            return True, True

        is_deletable = True
        is_renamable = True

        for tid in tournament_ids:
            matches_res = await db.execute(select(Match.id).where(Match.tournament_id == tid).limit(1))
            has_matches = matches_res.scalar_one_or_none() is not None
            
            if not has_matches:
                is_deletable = False
            else:
                final_match_res = await db.execute(
                    select(Match.id)
                    .where(Match.tournament_id == tid, Match.next_match_id == None)
                )
                final_match_id = final_match_res.scalar_one_or_none()
                
                has_result = False
                if final_match_id:
                    result_res = await db.execute(
                        select(Result.id).where(Result.match_id == final_match_id).limit(1)
                    )
                    has_result = result_res.scalar_one_or_none() is not None
                    
                if not has_result:
                    is_deletable = False
                    is_renamable = False

        return is_deletable, is_renamable

team_repository = TeamRepository()
