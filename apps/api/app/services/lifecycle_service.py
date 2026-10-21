from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import DbSession
from app.core.exceptions import (
    CheckinDisabledError,
    InvalidGroupsError,
    NotEnoughTeamsError,
    TournamentAlreadyStartedError,
)
from app.models.team import Team
from app.models.tournament import TournamentMode, TournamentTeam
from app.schemas.tournament import TournamentStartResponse
from app.services.bracket_service import BracketService
from app.services.groups import size_problem
from app.services.revision import bump
from app.services.tournament_service import TournamentService


class LifecycleService:
    """Steps that span several parts of a tournament."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def set_registration_open(self, tournament_id: UUID, is_open: bool) -> None:
        """Open or close the registration by hand, at any time before the start."""
        tournament = await TournamentService(self.db).get_tournament(tournament_id, for_update=True)
        if tournament.is_started:
            raise TournamentAlreadyStartedError()
        tournament.registration_is_open = is_open
        tournament.registration_changed_at = datetime.now(UTC)
        await self.db.flush()
        await bump(self.db, tournament_id, "tournament")

    async def set_checkin_open(self, tournament_id: UUID, is_open: bool) -> None:
        """Open or close check-in by hand, at any time before the start."""
        tournament = await TournamentService(self.db).get_tournament(tournament_id, for_update=True)
        if tournament.is_started:
            raise TournamentAlreadyStartedError()
        if not tournament.checkin_enabled:
            raise CheckinDisabledError()
        tournament.checkin_is_open = is_open
        tournament.checkin_changed_at = datetime.now(UTC)
        await self.db.flush()
        await bump(self.db, tournament_id, "tournament")

    async def start_tournament(self, tournament_id: UUID) -> TournamentStartResponse:
        """Start a tournament in one step.

        - with check-in: only checked-in teams play, all others are removed from the tournament
        - without check-in: all registered teams play
        - the bracket is drawn from the teams that play, then the tournament is marked as started
        Everything happens in one transaction while the tournament row is locked.
        """
        tournament = await TournamentService(self.db).get_tournament(tournament_id, for_update=True)
        if tournament.is_started:
            raise TournamentAlreadyStartedError()

        result = await self.db.execute(
            select(TournamentTeam).where(TournamentTeam.tournament_id == tournament_id)
        )
        entries = list(result.scalars().all())
        playing = [e for e in entries if e.is_checked_in or not tournament.checkin_enabled]
        if len(playing) < 2:
            raise NotEnoughTeamsError(tournament.checkin_enabled)

        if tournament.mode == TournamentMode.GROUPS_KNOCKOUT:
            problem = size_problem(len(playing), tournament.group_count, tournament.advance_per_group)
            if problem:
                raise InvalidGroupsError(problem)

        removed = [e for e in entries if e not in playing]
        for entry in removed:
            await self.db.delete(entry)

        # the tournament keeps the names the teams have now: renaming a team later does not change it
        names = dict(
            (await self.db.execute(select(Team.id, Team.name).where(Team.id.in_([e.team_id for e in playing])))).all()
        )
        for entry in playing:
            entry.team_name = names[entry.team_id]

        bracket = BracketService(self.db)
        await bracket.generate(tournament_id, [e.team_id for e in playing], tournament.mode)
        tournament.started_at = datetime.now(UTC)
        await self.db.flush()
        await bracket.assign_stations(tournament_id)
        await bump(self.db, tournament_id, "tournament", "teams", "bracket")

        return TournamentStartResponse(team_count=len(playing), removed_team_ids=[e.team_id for e in removed])


def get_lifecycle_service(db: DbSession) -> LifecycleService:
    return LifecycleService(db)
