"""Group stage and knock-out: groups, the places of the tree, ties decided by the organization, fixed groups."""
import uuid

import pytest

from app.core.database import get_db
from app.core.exceptions import KnockoutError, ResultConflictError
from app.models.tournament import TournamentMode
from app.schemas.result import ResultCreate
from app.services.bracket_layout import round_one_pairings
from app.services.groups import apply_order, knockout_seeds, open_ties, size_problem, split_into_groups
from main import app
from tests.helpers import generate_started_tournament, won

USER = uuid.uuid4()
GK = TournamentMode.GROUPS_KNOCKOUT


def test_the_groups_differ_in_size_by_one_at_most():
    assert [len(g) for g in split_into_groups(list(range(10)), 3)] == [4, 3, 3]


def test_the_seconds_meet_the_winners_of_the_partner_group():
    seeds = knockout_seeds(2, 2)
    assert seeds == ["A1", "B1", "A2", "B2"]
    assert round_one_pairings(seeds) == [("A1", "B2"), ("B1", "A2")]
    pairs = round_one_pairings(knockout_seeds(4, 2))
    assert ("A1", "B2") in pairs
    assert ("C1", "D2") in pairs
    assert all(a[0] != b[0] for a, b in pairs), "nobody meets its own group in the first round"


def test_a_group_needs_more_teams_than_go_on():
    assert size_problem(6, 2, 2) is None
    assert "mindestens 9 Teams" in size_problem(8, 3, 2)


def test_a_tie_matters_where_it_decides_who_goes_on_and_only_equal_teams_may_be_swapped():
    ranks = [("a", 1), ("b", 2), ("c", 2), ("d", 4)]
    assert open_ties(ranks, 1) == []
    assert open_ties(ranks, 2) == [["b", "c"]]
    assert apply_order(ranks, ["a", "c", "b", "d"]) == ["a", "c", "b", "d"]
    with pytest.raises(ValueError):
        apply_order(ranks, ["b", "a", "c", "d"])


async def _play_groups(service, tournament, winner_of):
    """Every group match with a result: `winner_of(match)` wins it 3:0."""
    for match in (await service.get_bracket(tournament.id)).matches:
        if match.group is not None:
            await service.report_result(match.id, ResultCreate(**won(match, winner_of(match))), USER)


@pytest.mark.asyncio
async def test_groups_then_the_knockout_the_organization_starts():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, teams = await generate_started_tournament(db, 6, GK, groups=(2, 2))
        bracket = await service.get_bracket(tournament.id)
        group_matches = [m for m in bracket.matches if m.group is not None]
        tree = [m for m in bracket.matches if m.group is None]
        assert len(group_matches) == 6  # two groups of three: three matches each
        assert [g.group for g in bracket.groups] == [1, 2]
        assert sorted((m.source_a, m.source_b) for m in tree if m.round == 1) == [("A1", "B2"), ("B1", "A2")]
        assert all(m.team_a_id is None for m in tree)
        assert not bracket.knockout_started

        with pytest.raises(KnockoutError, match="alle Gruppenspiele"):
            await service.start_knockout(tournament.id, {})

        # the team listed first in the list of teams wins: a clear order in both groups
        await _play_groups(service, tournament, lambda m: min(m.team_a_id, m.team_b_id, key=teams.index))
        await service.start_knockout(tournament.id, {})
        bracket = await service.get_bracket(tournament.id)
        assert bracket.knockout_started
        first_round = [m for m in bracket.matches if m.group is None and m.round == 1]
        assert all(m.team_a_id and m.team_b_id for m in first_round)

        group_match = next(m for m in bracket.matches if m.group is not None)
        with pytest.raises(ResultConflictError, match="stehen fest"):
            await service.delete_result(group_match.id, USER)

        for match in first_round:
            await service.report_result(match.id, ResultCreate(**won(match, match.team_a_id)), USER)
        final = next(m for m in (await service.get_bracket(tournament.id)).matches if m.group is None and m.round == 2)
        await service.report_result(final.id, ResultCreate(**won(final, final.team_b_id)), USER)
        assert (await service.get_bracket(tournament.id)).champion_team_id == final.team_b_id
        assert tournament.finished_at is not None


@pytest.mark.asyncio
async def test_a_tie_where_it_matters_needs_the_order_of_the_organization():
    async for db in app.dependency_overrides[get_db]():
        # one group of three, two go on: everybody wins once, all three share the first place
        service, tournament, _ = await generate_started_tournament(db, 3, GK, groups=(1, 2))
        bracket = await service.get_bracket(tournament.id)
        for match in (m for m in bracket.matches if m.group is not None):
            await service.report_result(match.id, ResultCreate(**won(match, match.team_a_id)), USER)
        table = (await service.get_bracket(tournament.id)).groups[0].standings
        assert {row.rank for row in table} == {1}

        with pytest.raises(KnockoutError, match="Gleichstand"):
            await service.start_knockout(tournament.id, {})
        order = [row.team_id for row in reversed(table)]
        await service.start_knockout(tournament.id, {1: order})
        final = next(m for m in (await service.get_bracket(tournament.id)).matches if m.group is None)
        assert (final.team_a_id, final.team_b_id) == (order[0], order[1])
