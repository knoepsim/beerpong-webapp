import math
import secrets
import uuid
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    InvalidWinnerError,
    MatchNotReadyError,
    NotFoundError,
    ResultConflictError,
    TournamentNotStartedError,
)
from app.models.match import Match
from app.models.result import Result, ResultType
from app.schemas.match import BracketResponse, MatchResponse, MatchStatus
from app.schemas.result import ResultCreate
from app.services.bracket_layout import round_one_pairings
from app.services.revision import bump
from app.services.tournament_service import TournamentService
from fastapi import Depends
from typing import Annotated
from app.core.database import get_db


class BracketService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_bracket(self, tournament_id: UUID, team_ids: list[UUID]) -> list[Match]:
        """Draw a single-elimination bracket for the given teams.

        - Shuffles the teams randomly
        - Byes (non-power-of-2 team counts) get no match: the team is entered directly into its
          match of the next round; byes are spread evenly over the bracket (see bracket_layout)
        - Creates the full match tree with next_match references
        Called when the tournament starts (see LifecycleService), never on its own.
        """
        shuffled = list(team_ids)
        # Für das Mischen der Teams reicht diese Zufallsverteilung aus und birgt kein Sicherheitsrisiko
        secrets.SystemRandom().shuffle(shuffled)  # NOSONAR

        matches = self._build_matches(tournament_id, round_one_pairings(shuffled))
        # Parents first: next_match_id is a foreign key to matches
        self.db.add_all(matches)
        await self.db.flush()
        return matches


    def _build_matches(self, tournament_id: UUID, pairings: list[tuple[UUID | None, UUID | None]]
    ) -> list[Match]:
        """Create the match tree for the given first-round pairings, ordered final first."""
        total_rounds = int(math.log2(len(pairings))) + 1
        rounds: dict[int, list[Match | None]] = {}

        for round_num in range(1, total_rounds + 1):
            if round_num == 1:
                rounds[1] = [
                    Match(id=uuid.uuid4(), tournament_id=tournament_id, round=1, position=pos, team_a_id=a, team_b_id=b)
                    if a is not None and b is not None
                    else None
                    for pos, (a, b) in enumerate(pairings)
                ]
            else:
                rounds[round_num] = [
                    Match(id=uuid.uuid4(), tournament_id=tournament_id, round=round_num, position=pos)
                    for pos in range(len(pairings) // 2 ** (round_num - 1))
                ]

        for round_num in range(1, total_rounds):
            for pos, match in enumerate(rounds[round_num]):
                parent = rounds[round_num + 1][pos // 2]
                slot = "a" if pos % 2 == 0 else "b"
                if match is not None:
                    match.next_match_id = parent.id
                    match.next_match_slot = slot
                else:
                    # Bye in round one: the single team skips the match
                    team_id = pairings[pos][0] or pairings[pos][1]
                    setattr(parent, f"team_{slot}_id", team_id)

        return [m for round_num in range(total_rounds, 0, -1) for m in rounds[round_num] if m is not None]


    async def _delete_bracket(self, tournament_id: UUID) -> None:
        """Remove all matches of a tournament (only valid before it has started)."""
        await self.db.execute(
            update(Match).where(Match.tournament_id == tournament_id).values(next_match_id=None)
        )
        await self.db.execute(delete(Match).where(Match.tournament_id == tournament_id))


    async def _advance_team(self, next_match_id: UUID, slot: str | None, team_id: UUID
    ) -> None:
        """Place a team into the specified slot of a match."""
        result = await self.db.execute(select(Match).where(Match.id == next_match_id))
        next_match = result.scalar_one_or_none()
        if next_match is None:
            return

        if slot == "a":
            next_match.team_a_id = team_id
        elif slot == "b":
            next_match.team_b_id = team_id


    async def _get_match(self, match_id: UUID, *, for_update: bool = False) -> Match:
        stmt = select(Match).where(Match.id == match_id)
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        match = result.scalar_one_or_none()
        if match is None:
            raise NotFoundError("Match")
        return match


    async def _current_results(self, match_ids: list[UUID]) -> dict[UUID, Result]:
        """The current result per match: its latest event, unless that event is a deletion.

        One query for all matches (the result log is append-only, the last event wins).
        """
        if not match_ids:
            return {}
        rows = await self.db.execute(
            select(Result).where(Result.match_id.in_(match_ids)).order_by(Result.created_at)
        )
        latest = {r.match_id: r for r in rows.scalars()}
        return {match_id: r for match_id, r in latest.items() if r.type != ResultType.DELETED}

    async def _has_active_result(self, match_id: UUID) -> bool:
        """A match is decided if its latest event is not a deletion."""
        return match_id in await self._current_results([match_id])


    async def _record_result(
        self,
        match_id: UUID,
        result_type: ResultType,
        user_id: UUID,
        winner_team_id: UUID | None = None,
        cups_left: int | None = None,
    ) -> Result:
        """Append a result event and propagate the winner (or its removal) to the next match.

        Single place for all result rules:
        - the tournament must be running
        - CREATED needs a ready match without active result, MODIFIED/DELETED need an active one
        - the winner must be one of the match's two teams
        - the next match must not be decided yet
        """
        # Lock the match and its successor (always in this order) so concurrent reports for the
        # same match or the same bracket path cannot pass the checks below at the same time
        match = await self._get_match(match_id, for_update=True)
        if match.next_match_id is not None:
            await self._get_match(match.next_match_id, for_update=True)
        tournament = await TournamentService(self.db).get_tournament(match.tournament_id)
        if not tournament.is_started:
            raise TournamentNotStartedError()

        is_active = await self._has_active_result(match_id)
        if result_type == ResultType.CREATED and is_active:
            raise ResultConflictError("This match already has a result. Modify it instead.")
        if result_type != ResultType.CREATED and not is_active:
            raise ResultConflictError("This match has no result to modify or delete.")

        if result_type != ResultType.DELETED:
            if match.team_a_id is None or match.team_b_id is None:
                raise MatchNotReadyError()
            if winner_team_id not in (match.team_a_id, match.team_b_id):
                raise InvalidWinnerError()

        if match.next_match_id is not None and await self._has_active_result(match.next_match_id):
            raise ResultConflictError(
                "The next match already has a result. Delete the next match's result first."
            )

        entry = Result(
            match_id=match_id,
            type=result_type,
            winner_team_id=winner_team_id,
            cups_left=cups_left,
            reported_by_user_id=user_id,
        )
        self.db.add(entry)

        if match.next_match_id is None:
            # the final: its result decides whether the tournament is over
            tournament.finished_at = None if result_type == ResultType.DELETED else datetime.now(UTC)
        else:
            await self._advance_team(match.next_match_id, match.next_match_slot, winner_team_id)

        await self.db.flush()
        await bump(self.db, tournament.id, "bracket", "tournament")
        return entry


    async def report_result(self, match_id: UUID, data: ResultCreate, user_id: UUID) -> Result:
        """Report the first result for a match and advance the winner."""
        return await self._record_result(
            match_id, ResultType.CREATED, user_id, data.winner_team_id, data.cups_left
        )


    async def modify_result(self, match_id: UUID, data: ResultCreate, user_id: UUID) -> Result:
        """Modify an existing result, updating the winner in the next match."""
        return await self._record_result(
            match_id, ResultType.MODIFIED, user_id, data.winner_team_id, data.cups_left
        )


    async def delete_result(self, match_id: UUID, user_id: UUID) -> Result:
        """Mark the current result as deleted, removing the winner from the next match."""
        return await self._record_result(match_id, ResultType.DELETED, user_id)


    async def get_bracket(self, tournament_id: UUID) -> BracketResponse:
        """Get the complete bracket tree for a tournament."""
        result = await self.db.execute(
            select(Match)
            .where(Match.tournament_id == tournament_id)
            .order_by(Match.round, Match.position)
        )
        matches = list(result.scalars().all())
        results = await self._current_results([m.id for m in matches])

        total_rounds = max((m.round for m in matches), default=0)
        responses = [self._to_response(m, results.get(m.id)) for m in matches]
        final = next((r for r in responses if r.round == total_rounds), None)

        return BracketResponse(
            tournament_id=tournament_id,
            total_rounds=total_rounds,
            champion_team_id=final.winner_team_id if final else None,
            matches=responses,
        )

    @staticmethod
    def _to_response(match: Match, current: Result | None) -> MatchResponse:
        if current is not None:
            status = MatchStatus.FINISHED
        elif match.team_a_id is not None and match.team_b_id is not None:
            status = MatchStatus.READY
        else:
            status = MatchStatus.WAITING
        return MatchResponse.model_validate(match).model_copy(
            update={
                "status": status,
                "winner_team_id": current.winner_team_id if current else None,
                "cups_left": current.cups_left if current else None,
            }
        )



def get_bracket_service(db: Annotated[AsyncSession, Depends(get_db)]) -> BracketService:
    return BracketService(db)
