"""The table planner on its own: who plays next and where."""
from app.services.table_planner import (
    PlanMatch,
    assign_free_tables,
    certain_next_tables,
    plan,
)

TABLES = ["T1", "T2"]


def m(mid, rnd=1, pos=0, **kw) -> PlanMatch:
    return PlanMatch(id=mid, round=rnd, position=pos, **kw)


def test_ready_matches_get_free_tables_first_come_first_served():
    matches = [
        m("late", pos=0, ready=True, ready_at=5),
        m("early", pos=1, ready=True, ready_at=1),
        m("middle", pos=2, ready=True, ready_at=3),
    ]
    assert assign_free_tables(matches, TABLES) == {"early": "T1", "middle": "T2"}
    assert plan(matches, TABLES).queue == ["late"]


def test_ties_go_by_round_and_position():
    matches = [m("r2", rnd=2, ready=True, ready_at=0), m("r1b", pos=1, ready=True, ready_at=0), m("r1a", ready=True, ready_at=0)]
    assert list(assign_free_tables(matches, TABLES)) == ["r1a", "r1b"]


def test_a_match_being_played_never_moves_and_its_table_is_taken():
    matches = [
        m("playing", ready=True, ready_at=9, playing=True, table="T2"),
        m("next", pos=1, ready=True, ready_at=1),
    ]
    assert assign_free_tables(matches, TABLES) == {"playing": "T2", "next": "T1"}


def test_nothing_starts_without_a_free_table_or_before_both_teams_are_known():
    matches = [
        m("a", ready=True, ready_at=0, playing=True, table="T1"),
        m("b", pos=1, ready=True, ready_at=0, playing=True, table="T2"),
        m("c", pos=2, ready=True, ready_at=0),
        m("d", rnd=2, feeders=("a", "b")),
    ]
    assert assign_free_tables(matches, TABLES) == {"a": "T1", "b": "T2"}
    assert plan(matches, TABLES).queue == ["c"]


def test_the_winner_stays_at_the_table_of_the_feeder_that_finished_last():
    matches = [
        m("a", finished=True, finished_at=1, table="T1"),
        m("b", pos=1, finished=True, finished_at=7, table="T2"),
        m("final", rnd=2, feeders=("a", "b"), ready=True, ready_at=7),
    ]
    assert assign_free_tables(matches, TABLES) == {"final": "T2"}


def test_without_the_winners_table_the_match_takes_the_first_free_one():
    matches = [
        m("a", finished=True, finished_at=1, table="T1"),
        m("b", pos=1, finished=True, finished_at=7, table="T2"),
        m("other", rnd=2, pos=1, ready=True, ready_at=0, playing=True, table="T2"),
        m("final", rnd=2, feeders=("a", "b"), ready=True, ready_at=7),
    ]
    assert assign_free_tables(matches, TABLES)["final"] == "T1"


def test_a_reopened_match_gets_its_old_table_back_if_free():
    matches = [m("reopened", ready=True, ready_at=0, table="T2")]
    assert assign_free_tables(matches, TABLES) == {"reopened": "T2"}


def test_a_match_far_ahead_of_the_lowest_open_round_waits_even_with_a_free_table():
    matches = [
        m("slow", rnd=1, ready=True, ready_at=0, playing=True, table="T1"),
        m("far", rnd=4, ready=True, ready_at=1),
        m("near", rnd=3, pos=1, ready=True, ready_at=2),
    ]
    playing = assign_free_tables(matches, TABLES, window=2)
    assert "far" not in playing and playing["near"] == "T2"
    # it keeps its place in the queue for when the window opens
    assert plan(matches, TABLES, window=2).queue == ["far"]


def test_matches_of_several_rounds_play_at_the_same_time():
    matches = [
        m("long", rnd=1, ready=True, ready_at=0, playing=True, table="T1"),
        m("r2", rnd=2, ready=True, ready_at=3),
    ]
    assert assign_free_tables(matches, TABLES) == {"long": "T1", "r2": "T2"}


def test_a_table_that_was_deleted_is_not_kept():
    matches = [m("a", ready=True, ready_at=0, playing=True, table="gone")]
    assert assign_free_tables(matches, TABLES) == {"a": "T1"}


def test_no_tables_no_plan():
    matches = [m("a", ready=True, ready_at=0)]
    assert assign_free_tables(matches, []) == {}
    assert plan(matches, []).queue == ["a"]


# -- certain tables of matches that still wait for a team -------------------------------------------------------


def semis_and_final(**second_semi):
    return [
        m("s1", finished=True, finished_at=5, table="T1"),
        m("s2", pos=1, **({"ready": True, "ready_at": 0, "playing": True, "table": "T2"} | second_semi)),
        m("final", rnd=2, feeders=("s1", "s2")),
    ]


def test_with_a_table_for_every_open_match_the_waiting_team_knows_its_table():
    # the winner of the second semi-final stays at its table, the other finalist comes there
    assert certain_next_tables(semis_and_final(), ["T1", "T2", "T3"], now=10) == {"final": "T2"}
    assert certain_next_tables(semis_and_final(), ["T1", "T2"], now=10) == {"final": "T2"}


def test_nothing_is_certain_with_fewer_tables_than_open_matches():
    matches = semis_and_final() + [m("other", pos=2, ready=True, ready_at=0, playing=True, table="T1")]
    assert certain_next_tables(matches, ["T1", "T2"], now=10) == {}


def test_nothing_is_certain_while_matches_queue():
    matches = semis_and_final() + [m("queued", pos=2, ready=True, ready_at=1)]
    assert certain_next_tables(matches, ["T2"], now=10) == {}


def test_nothing_is_certain_while_both_feeders_play_or_the_missing_one_has_no_table():
    both_open = [m("s1", ready=True, ready_at=0, playing=True, table="T1")] + semis_and_final()[1:]
    assert certain_next_tables(both_open, ["T1", "T2", "T3"], now=10) == {}
    not_at_a_table = semis_and_final(playing=False, table=None, ready=False, ready_at=None)
    assert certain_next_tables(not_at_a_table, ["T1", "T2", "T3"], now=10) == {}
