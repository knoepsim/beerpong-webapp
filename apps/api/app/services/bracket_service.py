import math
import secrets
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    InvalidWinnerError,
    MatchNotReadyError,
    NotFoundError,
    ResultConflictError,
    TournamentAlreadyStartedError,
    TournamentNotStartedError,
)
from app.models.match import Match
from app.models.result import Result, ResultType
from app.models.tournament import TournamentTeam
from app.schemas.match import BracketResponse, MatchResponse
from app.schemas.result import ResultCreate
from app.services.tournament_service import TournamentService
from fastapi import Depends
from typing import Annotated
from app.core.database import get_db


class BracketService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_bracket(self, tournament_id: UUID) -> list[Match]:
        """Generate a single-elimination bracket for a tournament.

        - Shuffles all participating teams randomly
        - Handles byes for non-power-of-2 team counts
        - Creates the full match tree with next_match references
        """
        tournament = await TournamentService(self.db).get_tournament(tournament_id, for_update=True)
        if tournament.is_started:
            raise TournamentAlreadyStartedError()

        # Regenerating before the start replaces the previous bracket
        await self._delete_bracket(tournament_id)

        # Get all teams in the tournament
        result = await self.db.execute(
            select(TournamentTeam).where(TournamentTeam.tournament_id == tournament_id)
        )
        entries = list(result.scalars().all())
        team_ids = [e.team_id for e in entries]
        # Für das Mischen der Teams reicht diese Zufallsverteilung aus und birgt kein Sicherheitsrisiko
        secrets.SystemRandom().shuffle(team_ids)  # NOSONAR

        num_teams = len(team_ids)
        if num_teams < 2:
            raise ValueError("At least 2 teams are required to generate a bracket")

        # Calculate bracket size (next power of 2)
        total_slots = 2 ** math.ceil(math.log2(num_teams))
        total_rounds = int(math.log2(total_slots))

        matches_by_round, all_matches = self._create_empty_matches(tournament_id, total_rounds, total_slots)
        await self.db.flush()  # Generate IDs for all matches

        self._link_matches(matches_by_round, total_rounds)
        await self._assign_teams_and_process_byes(matches_by_round[1], team_ids, all_matches)

        return all_matches


    async def _delete_bracket(self, tournament_id: UUID) -> None:
        """Remove all matches of a tournament (only valid before it has started)."""
        await self.db.execute(
            update(Match).where(Match.tournament_id == tournament_id).values(next_match_id=None)
        )
        await self.db.execute(delete(Match).where(Match.tournament_id == tournament_id))


    def _create_empty_matches(self, tournament_id: UUID, total_rounds: int, total_slots: int
    ) -> tuple[dict[int, list[Match]], list[Match]]:
        """Helper to create match entities for all rounds."""
        all_matches = []
        matches_by_round = {}
        for round_num in range(total_rounds, 0, -1):
            matches_in_round = total_slots // (2**round_num)
            round_matches = []
            for pos in range(matches_in_round):
                match = Match(tournament_id=tournament_id, round=round_num, position=pos)
                self.db.add(match)
                round_matches.append(match)
                all_matches.append(match)
            matches_by_round[round_num] = round_matches
        return matches_by_round, all_matches


    def _link_matches(self, matches_by_round: dict[int, list[Match]], total_rounds: int) -> None:
        """Helper to link matches to their parents in the next round."""
        for round_num in range(1, total_rounds):
            current_round = matches_by_round[round_num]
            next_round = matches_by_round[round_num + 1]
            for i, match in enumerate(current_round):
                parent_match = next_round[i // 2]
                match.next_match_id = parent_match.id
                match.next_match_slot = "a" if i % 2 == 0 else "b"


    async def _assign_teams_and_process_byes(self, round_1_matches: list[Match], team_ids: list[UUID], all_matches: list[Match]
    ) -> None:
        """Helper to assign teams to round 1 and advance teams with byes."""
        num_teams = len(team_ids)
        team_index = 0

        for match in round_1_matches:
            if team_index < num_teams:
                match.team_a_id = team_ids[team_index]
                team_index += 1
            if team_index < num_teams:
                match.team_b_id = team_ids[team_index]
                team_index += 1

        for match in round_1_matches:
            if match.team_a_id is not None and match.team_b_id is None:
                # Bye: team_a advances directly
                if match.next_match_id is not None:
                    await self._advance_team(match.next_match_id, match.next_match_slot, match.team_a_id)
                # Remove this bye match (no actual game)
                await self.db.delete(match)
                all_matches.remove(match)


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


    async def _has_active_result(self, match_id: UUID) -> bool:
        """A match is decided if its latest event is not a deletion."""
        result = await self.db.execute(
            select(Result)
            .where(Result.match_id == match_id)
            .order_by(Result.created_at.desc())
            .limit(1)
        )
        latest = result.scalar_one_or_none()
        return latest is not None and latest.type != ResultType.DELETED


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

        if match.next_match_id is not None:
            await self._advance_team(match.next_match_id, match.next_match_slot, winner_team_id)

        await self.db.flush()
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

        total_rounds = max((m.round for m in matches), default=0)

        return BracketResponse(
            tournament_id=tournament_id,
            total_rounds=total_rounds,
            matches=[MatchResponse.model_validate(m) for m in matches],
        )



def get_bracket_service(db: Annotated[AsyncSession, Depends(get_db)]) -> BracketService:
    return BracketService(db)
