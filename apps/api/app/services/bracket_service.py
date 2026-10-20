import math
import secrets
import uuid
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.games import check_score
from app.core.exceptions import (
    InvalidWinnerError,
    MatchNotAtTableError,
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
from app.models.tournament_table import TournamentTable
from app.services.revision import bump
from app.services.table_planner import PlanMatch, assign_free_tables, certain_next_tables, plan
from app.services.tournament_service import TournamentService
from app.core.database import DbSession


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
            raise NotFoundError("Spiel")
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
        score: tuple[int, int] | None = None,
    ) -> Result:
        """Append a result event and propagate the winner (or its removal) to the next match.

        Single place for all result rules:
        - the tournament must be running
        - CREATED needs a ready match without active result, MODIFIED/DELETED need an active one
        - the winner must be one of the match's two teams, and the score possible in the game with that winner
        - the next match must not be decided yet
        """
        # Lock the tournament, then the match and its successor (always in this order): concurrent reports cannot
        # pass the checks below at the same time, and the tables are planned by one report after the other
        tournament_id = (await self._get_match(match_id)).tournament_id
        tournament = await TournamentService(self.db).get_tournament(tournament_id, for_update=True)
        match = await self._get_match(match_id, for_update=True)
        if match.next_match_id is not None:
            await self._get_match(match.next_match_id, for_update=True)
        if not tournament.is_started:
            raise TournamentNotStartedError()

        is_active = await self._has_active_result(match_id)
        if result_type == ResultType.CREATED and is_active:
            raise ResultConflictError("Für dieses Spiel gibt es schon ein Ergebnis. Ändere es stattdessen.")
        if result_type != ResultType.CREATED and not is_active:
            raise ResultConflictError("Für dieses Spiel gibt es noch kein Ergebnis.")

        if result_type != ResultType.DELETED:
            if match.team_a_id is None or match.team_b_id is None:
                raise MatchNotReadyError()
            if winner_team_id not in (match.team_a_id, match.team_b_id):
                raise InvalidWinnerError()
            score_a, score_b = score or (0, 0)
            winner_score, loser_score = (score_a, score_b) if winner_team_id == match.team_a_id else (score_b, score_a)
            check_score(tournament.game, winner_score, loser_score)

        if match.next_match_id is not None and await self._has_active_result(match.next_match_id):
            raise ResultConflictError(
                "Das nächste Spiel hat schon ein Ergebnis. Lösche zuerst dieses Ergebnis, dann kannst du hier etwas ändern."
            )

        entry = Result(
            match_id=match_id,
            type=result_type,
            winner_team_id=winner_team_id,
            score_a=score[0] if score else None,
            score_b=score[1] if score else None,
            reported_by_user_id=user_id,
        )
        self.db.add(entry)

        if match.next_match_id is None:
            # the final: its result decides whether the tournament is over
            tournament.finished_at = None if result_type == ResultType.DELETED else datetime.now(UTC)
        else:
            await self._advance_team(match.next_match_id, match.next_match_slot, winner_team_id)

        await self.db.flush()
        await self.assign_tables(tournament.id)
        await bump(self.db, tournament.id, "bracket", "tournament")
        return entry

    # -- tables ---------------------------------------------------------------------------------------------

    async def _plan_input(self, tournament_id: UUID) -> tuple[list[Match], list[PlanMatch], list[UUID], dict]:
        matches = list(
            (await self.db.execute(select(Match).where(Match.tournament_id == tournament_id))).scalars().all()
        )
        results = await self._current_results([m.id for m in matches])
        table_ids = list(
            (
                await self.db.execute(
                    select(TournamentTable.id)
                    .where(TournamentTable.tournament_id == tournament_id)
                    .order_by(TournamentTable.position)
                )
            ).scalars()
        )
        feeders: dict[UUID, list[UUID]] = {}
        for m in matches:
            if m.next_match_id is not None:
                feeders.setdefault(m.next_match_id, []).append(m.id)
        planned = [
            PlanMatch(
                id=m.id,
                round=m.round,
                position=m.position,
                feeders=tuple(feeders.get(m.id, ())),
                ready=m.team_a_id is not None and m.team_b_id is not None,
                ready_at=_timestamp(m.ready_at),
                finished=m.id in results,
                finished_at=_timestamp(results[m.id].created_at) if m.id in results else None,
                table=m.table_id,
                playing=m.on_table_at is not None,
            )
            for m in matches
        ]
        return matches, planned, table_ids, results

    async def assign_tables(self, tournament_id: UUID) -> None:
        """Bring the matches to the tables: keep what is being played, give free tables to the next ready matches.

        Runs after the draw, after every result (also corrections) and when tables are added or deleted; the caller
        holds the lock of the tournament, so one planning follows the other. See services/table_planner.py.
        """
        now = datetime.now(UTC)
        matches, _, table_ids, results = await self._plan_input(tournament_id)
        for m in matches:
            ready = m.team_a_id is not None and m.team_b_id is not None
            if not ready:
                # it lost a team (a result was taken back): it waits again, without a table
                m.ready_at = m.table_id = m.on_table_at = None
            elif m.ready_at is None:
                m.ready_at = now
            # a match that is over or lost its table is not at a table (and so not live either)
            if m.id in results or m.table_id not in table_ids:
                m.on_table_at = None
            if m.on_table_at is None:
                m.started_at = None
        await self.db.flush()

        _, planned, _, _ = await self._plan_input(tournament_id)
        by_id = {m.id: m for m in matches}
        for match_id, table_id in assign_free_tables(planned, table_ids).items():
            match = by_id[match_id]
            if match.on_table_at is None:
                match.table_id = table_id
                match.on_table_at = now
        await self.db.flush()


    async def set_started(self, match_id: UUID, started: bool) -> None:
        """Start a match at its table (live), or take the start back. A result can be reported without a start."""
        tournament_id = (await self._get_match(match_id)).tournament_id
        tournament = await TournamentService(self.db).get_tournament(tournament_id, for_update=True)
        match = await self._get_match(match_id, for_update=True)
        if not tournament.is_started:
            raise TournamentNotStartedError()
        if await self._has_active_result(match_id):
            raise ResultConflictError("Das Spiel hat schon ein Ergebnis.")
        if started and match.on_table_at is None:
            raise MatchNotAtTableError()
        if started and match.started_at is None:
            match.started_at = datetime.now(UTC)
        elif not started:
            match.started_at = None
        await self.db.flush()
        await bump(self.db, tournament.id, "bracket")

    async def report_result(self, match_id: UUID, data: ResultCreate, user_id: UUID) -> Result:
        """Report the first result for a match and advance the winner."""
        return await self._record_result(
            match_id, ResultType.CREATED, user_id, data.winner_team_id, (data.score_a, data.score_b)
        )


    async def modify_result(self, match_id: UUID, data: ResultCreate, user_id: UUID) -> Result:
        """Modify an existing result, updating the winner in the next match."""
        return await self._record_result(
            match_id, ResultType.MODIFIED, user_id, data.winner_team_id, (data.score_a, data.score_b)
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
        names = dict(
            (
                await self.db.execute(
                    select(TournamentTable.id, TournamentTable.name).where(TournamentTable.tournament_id == tournament_id)
                )
            ).all()
        )
        _, planned, table_ids, _ = await self._plan_input(tournament_id)
        queue = {match_id: place for place, match_id in enumerate(plan(planned, table_ids).queue, start=1)}
        upcoming = certain_next_tables(planned, table_ids, datetime.now(UTC).timestamp())
        responses = [
            self._to_response(m, results.get(m.id)).model_copy(
                update={
                    "table_name": names.get(m.table_id),
                    "queue_position": queue.get(m.id),
                    "upcoming_table_id": upcoming.get(m.id),
                    "upcoming_table_name": names.get(upcoming.get(m.id)),
                }
            )
            for m in matches
        ]
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
        elif match.team_a_id is None or match.team_b_id is None:
            status = MatchStatus.WAITING
        elif match.started_at is not None:
            status = MatchStatus.LIVE
        elif match.on_table_at is not None:
            status = MatchStatus.READY
        else:
            status = MatchStatus.QUEUED
        return MatchResponse.model_validate(match).model_copy(
            update={
                "status": status,
                "winner_team_id": current.winner_team_id if current else None,
                "score_a": current.score_a if current else None,
                "score_b": current.score_b if current else None,
            }
        )



def get_bracket_service(db: DbSession) -> BracketService:
    return BracketService(db)


def _timestamp(value: datetime | None) -> float | None:
    """A comparable number for the planner (naive values from SQLite count as UTC)."""
    if value is None:
        return None
    return (value if value.tzinfo else value.replace(tzinfo=UTC)).timestamp()
