"""Everybody against everybody: match days, the table, draws and the end."""
import uuid
from itertools import combinations

import pytest

from app.core.database import get_db
from app.core.exceptions import InvalidScoreError
from app.models.tournament import Game, TournamentMode
from app.schemas.result import ResultCreate
from app.services.round_robin import Played, match_days, standings
from main import app
from tests.helpers import generate_started_tournament, won

USER = uuid.uuid4()
RR = TournamentMode.ROUND_ROBIN


@pytest.mark.parametrize("n", [2, 3, 4, 5, 8, 9])
def test_every_pair_meets_once_and_nobody_plays_twice_a_day(n):
    days = match_days(list(range(n)))
    assert len(days) == (n - 1 if n % 2 == 0 else n)
    pairs = [frozenset(p) for day in days for p in day]
    assert sorted(map(sorted, pairs)) == sorted(map(sorted, map(frozenset, combinations(range(n), 2))))
    for day in days:
        teams = [t for pair in day for t in pair]
        assert len(teams) == len(set(teams))


def test_the_table_counts_points_then_direct_comparison_then_difference():
    results = [
        Played("a", "b", 2, 1, "a"),
        Played("b", "c", 3, 0, "b"),
        Played("c", "a", 1, 0, "c"),  # a, b and c have 3 points each, equal among themselves
        Played("a", "d", 5, 0, "a"),
        Played("b", "d", 1, 0, "b"),
        Played("c", "d", 1, 1, None),
    ]
    table = standings(["a", "b", "c", "d"], results)
    assert [(r.team_id, r.points, r.rank) for r in table] == [("a", 6, 1), ("b", 6, 2), ("c", 4, 3), ("d", 1, 4)]
    # a and b: 6 points each, a won their match
    assert (table[2].won, table[2].drawn, table[2].lost) == (1, 1, 1)


def test_teams_equal_in_everything_share_their_rank():
    table = standings(["a", "b", "c"], [Played("a", "b", 1, 1, None)])
    assert [r.rank for r in table] == [1, 1, 3]


@pytest.mark.asyncio
async def test_round_robin_is_over_when_every_match_has_a_result_and_the_table_names_the_winner():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, teams = await generate_started_tournament(db, 3, RR)
        bracket = await service.get_bracket(tournament.id)
        assert bracket.mode == RR
        assert len(bracket.matches) == 3
        assert bracket.total_rounds == 3
        assert all(m.next_match_id is None for m in bracket.matches)
        assert [row.points for row in bracket.standings] == [0, 0, 0]

        best = teams[0]
        for match in bracket.matches:
            winner = best if best in (match.team_a_id, match.team_b_id) else match.team_a_id
            assert tournament.finished_at is None
            await service.report_result(match.id, ResultCreate(**won(match, winner)), USER)

        bracket = await service.get_bracket(tournament.id)
        assert tournament.finished_at is not None
        assert bracket.champion_team_id == best
        assert (bracket.standings[0].team_id, bracket.standings[0].points) == (best, 6)

        await service.delete_result(bracket.matches[0].id, USER)
        assert tournament.finished_at is None, "a result taken back opens it again"


@pytest.mark.asyncio
async def test_football_has_draws_only_where_everybody_plays_everybody():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await generate_started_tournament(db, 2, RR, Game.FOOTBALL)
        match = (await service.get_bracket(tournament.id)).matches[0]
        await service.report_result(match.id, ResultCreate(winner_team_id=None, score_a=1, score_b=1), USER)
        row = (await service.get_bracket(tournament.id)).standings[0]
        assert (row.drawn, row.points) == (1, 1)

    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await generate_started_tournament(db, 2, TournamentMode.SINGLE_ELIMINATION, Game.FOOTBALL)
        match = (await service.get_bracket(tournament.id)).matches[0]
        result = ResultCreate(winner_team_id=None, score_a=1, score_b=1)
        with pytest.raises(InvalidScoreError, match="Unentschieden"):
            await service.report_result(match.id, result, USER)


@pytest.mark.asyncio
async def test_beer_pong_has_no_draws():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await generate_started_tournament(db, 2, RR)
        match = (await service.get_bracket(tournament.id)).matches[0]
        result = ResultCreate(winner_team_id=None, score_a=0, score_b=0)
        with pytest.raises(InvalidScoreError):
            await service.report_result(match.id, result, USER)
