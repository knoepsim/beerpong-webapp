import math
import secrets
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ResultRequiresWinnerError
from app.models.match import Match
from app.models.result import Result, ResultType
from app.models.tournament import TournamentTeam
from app.schemas.match import BracketResponse, MatchResponse
from app.schemas.result import ResultCreate


async def generate_bracket(db: AsyncSession, tournament_id: UUID) -> list[Match]:
    """Generate a single-elimination bracket for a tournament.

    - Shuffles all participating teams randomly
    - Handles byes for non-power-of-2 team counts
    - Creates the full match tree with next_match references
    """
    # Get all teams in the tournament
    result = await db.execute(
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

    matches_by_round, all_matches = _create_empty_matches(db, tournament_id, total_rounds, total_slots)
    await db.flush()  # Generate IDs for all matches

    _link_matches(matches_by_round, total_rounds)
    await _assign_teams_and_process_byes(db, matches_by_round[1], team_ids, all_matches)

    return all_matches


def _create_empty_matches(
    db: AsyncSession, tournament_id: UUID, total_rounds: int, total_slots: int
) -> tuple[dict[int, list[Match]], list[Match]]:
    """Helper to create match entities for all rounds."""
    all_matches = []
    matches_by_round = {}
    for round_num in range(total_rounds, 0, -1):
        matches_in_round = total_slots // (2**round_num)
        round_matches = []
        for pos in range(matches_in_round):
            match = Match(tournament_id=tournament_id, round=round_num, position=pos)
            db.add(match)
            round_matches.append(match)
            all_matches.append(match)
        matches_by_round[round_num] = round_matches
    return matches_by_round, all_matches


def _link_matches(matches_by_round: dict[int, list[Match]], total_rounds: int) -> None:
    """Helper to link matches to their parents in the next round."""
    for round_num in range(1, total_rounds):
        current_round = matches_by_round[round_num]
        next_round = matches_by_round[round_num + 1]
        for i, match in enumerate(current_round):
            parent_match = next_round[i // 2]
            match.next_match_id = parent_match.id
            match.next_match_slot = "a" if i % 2 == 0 else "b"


async def _assign_teams_and_process_byes(
    db: AsyncSession, round_1_matches: list[Match], team_ids: list[UUID], all_matches: list[Match]
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
                await _advance_team(db, match.next_match_id, match.next_match_slot, match.team_a_id)
            # Remove this bye match (no actual game)
            await db.delete(match)
            all_matches.remove(match)


async def _advance_team(
    db: AsyncSession, next_match_id: UUID, slot: str | None, team_id: UUID
) -> None:
    """Place a team into the specified slot of a match."""
    result = await db.execute(select(Match).where(Match.id == next_match_id))
    next_match = result.scalar_one_or_none()
    if next_match is None:
        return

    if slot == "a":
        next_match.team_a_id = team_id
    elif slot == "b":
        next_match.team_b_id = team_id


async def report_result(
    db: AsyncSession, match_id: UUID, data: ResultCreate, user_id: UUID
) -> Result:
    """Report a result for a match and advance the winner to the next match."""
    # Verify match exists
    match_result = await db.execute(select(Match).where(Match.id == match_id))
    match = match_result.scalar_one_or_none()
    if match is None:
        raise NotFoundError("Match")

    if data.winner_team_id is None:
        raise ResultRequiresWinnerError()

    # Create result entry
    result_entry = Result(
        match_id=match_id,
        type=ResultType.CREATED,
        winner_team_id=data.winner_team_id,
        cups_left=data.cups_left,
        reported_by_user_id=user_id,
    )
    db.add(result_entry)

    # Advance winner to next match
    if match.next_match_id is not None:
        await _advance_team(db, match.next_match_id, match.next_match_slot, data.winner_team_id)

    await db.flush()
    return result_entry


async def get_bracket(db: AsyncSession, tournament_id: UUID) -> BracketResponse:
    """Get the complete bracket tree for a tournament."""
    result = await db.execute(
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
