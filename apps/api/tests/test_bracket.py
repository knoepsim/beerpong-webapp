"""Bracket layout and generation for every team count."""
import uuid
from datetime import UTC, datetime

import pytest

from app.core.database import get_db
from app.models.team import Team
from app.models.tournament import Tournament, TournamentMode, TournamentTeam, TournamentVisibility
from app.schemas.result import ResultCreate
from app.services.bracket_layout import bracket_size, round_one_pairings, seed_order
from app.services.bracket_service import BracketService
from main import app

TEAM_COUNTS = range(2, 41)


def test_seed_order_matches_the_standard_bracket():
    assert seed_order(2) == [1, 2]
    assert seed_order(4) == [1, 4, 2, 3]
    assert seed_order(8) == [1, 8, 4, 5, 2, 7, 3, 6]


@pytest.mark.parametrize("n", TEAM_COUNTS)
def test_pairings_are_valid_for_every_team_count(n: int):
    teams = [uuid.uuid4() for _ in range(n)]
    pairings = round_one_pairings(teams)
    size = bracket_size(n)

    assert len(pairings) == size // 2
    placed = [t for pair in pairings for t in pair if t is not None]
    assert sorted(placed) == sorted(teams), "every team exactly once"
    assert all(a is not None or b is not None for a, b in pairings), "no empty match"

    byes = [i for i, (a, b) in enumerate(pairings) if a is None or b is None]
    assert len(byes) == size - n
    half = len(pairings) // 2
    top = sum(1 for i in byes if i < half)
    assert abs(top - (len(byes) - top)) <= 1, "byes spread over both halves"


@pytest.mark.parametrize(
    ("n", "round_one_matches", "byes"),
    [(2, 1, 0), (3, 1, 1), (5, 1, 3), (6, 2, 2), (10, 2, 6), (12, 4, 4), (14, 6, 2), (16, 8, 0), (17, 1, 15)],
)
def test_byes_only_exist_in_round_one(n: int, round_one_matches: int, byes: int):
    """Round one plays N - 2^k matches, the remaining teams skip it; from round two on it is a full bracket."""
    pairings = round_one_pairings([uuid.uuid4() for _ in range(n)])
    matches = [p for p in pairings if None not in p]
    skipping = [p for p in pairings if None in p]

    assert len(matches) == round_one_matches
    assert len(skipping) == byes
    # everybody who plays round one or skips it is in round two: a power of two
    assert round_one_matches + byes == bracket_size(n) // 2


def test_single_team_is_rejected():
    with pytest.raises(ValueError):
        round_one_pairings([uuid.uuid4()])


async def _generate(db, n: int):
    tournament = Tournament(
        name="x",
        mode=TournamentMode.SINGLE_ELIMINATION,
        visibility=TournamentVisibility.PRIVATE,
        created_by_id=uuid.uuid4(),
    )
    db.add(tournament)
    await db.flush()
    teams = []
    for i in range(n):
        team = Team(name=f"T{i}")
        db.add(team)
        await db.flush()
        db.add(TournamentTeam(tournament_id=tournament.id, team_id=team.id))
        teams.append(team.id)
    await db.flush()
    service = BracketService(db)
    await service.generate_bracket(tournament.id)
    tournament.started_at = datetime.now(UTC)
    await db.flush()
    return service, tournament, teams


@pytest.mark.asyncio
@pytest.mark.parametrize("n", TEAM_COUNTS)
async def test_bracket_can_be_played_to_the_end(n: int):
    async for db in app.dependency_overrides[get_db]():
        service, tournament, teams = await _generate(db, n)
        matches = (await service.get_bracket(tournament.id)).matches
        assert len(matches) == n - 1, "single elimination needs n-1 matches"

        played: set = set()
        winner = None
        while True:
            matches = (await service.get_bracket(tournament.id)).matches
            ready = [m for m in matches if m.team_a_id and m.team_b_id and m.id not in played]
            if not ready:
                break
            match = min(ready, key=lambda m: (m.round, m.position))
            await service.report_result(match.id, ResultCreate(winner_team_id=match.team_a_id), uuid.uuid4())
            played.add(match.id)
            if match.next_match_id is None:
                winner = match.team_a_id

        assert len(played) == n - 1, "every match became playable"
        assert winner in teams


@pytest.mark.asyncio
async def test_regenerating_replaces_the_bracket():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await _generate(db, 5)
        tournament.started_at = None
        await db.flush()
        await service.generate_bracket(tournament.id)
        assert len((await service.get_bracket(tournament.id)).matches) == 4
