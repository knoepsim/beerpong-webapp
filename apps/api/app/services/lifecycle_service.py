from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import CheckinDisabledError, NotEnoughTeamsError, TournamentAlreadyStartedError
from app.models.tournament import TournamentTeam
from app.schemas.tournament import TournamentStartResponse
from app.services.bracket_service import BracketService
from app.services.tournament_service import TournamentService


class LifecycleService:
    """Steps that span several parts of a tournament."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def open_checkin(self, tournament_id: UUID) -> None:
        """Open check-in now, ahead of the planned time. This closes the registration. Opening twice is harmless."""
        tournament = await TournamentService(self.db).get_tournament(tournament_id, for_update=True)
        if tournament.is_started:
            raise TournamentAlreadyStartedError()
        if not tournament.checkin_enabled:
            raise CheckinDisabledError()
        if not tournament.checkin_open:
            tournament.checkin_opened_at = datetime.now(UTC)
            await self.db.flush()

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

        removed = [e for e in entries if e not in playing]
        for entry in removed:
            await self.db.delete(entry)

        await BracketService(self.db).generate_bracket(tournament_id, [e.team_id for e in playing])
        tournament.started_at = datetime.now(UTC)
        await self.db.flush()

        return TournamentStartResponse(team_count=len(playing), removed_team_ids=[e.team_id for e in removed])


def get_lifecycle_service(db: Annotated[AsyncSession, Depends(get_db)]) -> LifecycleService:
    return LifecycleService(db)
