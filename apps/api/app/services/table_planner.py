"""Which match is played at which table: pure planning logic (no database), shared by the server and the simulation.

The rules, chosen with scripts/simulate_tables.py (16-64 teams, 3-16 tables, random match lengths):

- A table plays one match at a time and becomes free when the result of its match is entered.
- A match can go to a table once both teams are known ("ready"). Ready matches get free tables **in the order in
  which they became ready** (first come, first served), ties by round and position. Long and short matches mix
  freely: whoever is ready takes the next free table, also from a later round, so several rounds run at once.
- **Round window:** a match more than `window` rounds ahead of the lowest round that still has an open match waits.
  In a knock-out bracket first come, first served keeps the rounds close anyway; the window only matters when single
  matches drag on, and then it shortens the waits at the end a little. Waiting round by round (window 0) makes the
  tournament 10-20 % longer and the waits much longer, so it is no option.
- **Winner stays:** a match takes the table of its feeder that finished last (that team is still sitting there),
  else its own earlier table (a reopened match), else the first free table.
- A table is only decided when a match actually goes to it. Fixing tables for later matches in advance makes the
  tournament 15-25 % longer (a table would stay empty while its match is not ready yet), and a predicted table for a
  later match is right only every third to fifth time. What can be told reliably is the place in the queue: with
  first come, first served it never gets worse.
"""
from collections.abc import Callable, Hashable, Sequence
from dataclasses import dataclass, field, replace

MatchId = Hashable
TableId = Hashable

DEFAULT_WINDOW = 2


@dataclass(frozen=True)
class PlanMatch:
    """A match as the planner sees it."""

    id: MatchId
    round: int
    position: int
    # matches whose winners play here (a bye has no match, so a match after a bye has a single feeder)
    feeders: tuple[MatchId, ...] = ()
    ready: bool = False  # both teams are known
    ready_at: float | None = None  # when it became ready (any comparable value: a timestamp, minutes)
    finished: bool = False
    finished_at: float | None = None
    table: TableId | None = None  # the table it is played at (playing) or was played at (finished, reopened)
    playing: bool = False


SortKey = Callable[[PlanMatch], tuple]


def first_come_first_served(match: PlanMatch) -> tuple:
    ready_at = match.ready_at if match.ready_at is not None else float("inf")
    return (ready_at, match.round, match.position)


@dataclass
class TablePlan:
    """The matches at a table now and the order in which the other ready matches will get one."""

    playing: dict[MatchId, TableId] = field(default_factory=dict)
    # ready matches without a table, next first: their place in the queue (a later ready match may join behind)
    queue: list[MatchId] = field(default_factory=list)


def _preferred_table(match: PlanMatch, by_id: dict[MatchId, PlanMatch], free: list[TableId]) -> TableId:
    feeders = [by_id[f] for f in match.feeders if f in by_id and by_id[f].finished and by_id[f].table is not None]
    feeders.sort(key=lambda f: f.finished_at if f.finished_at is not None else float("-inf"), reverse=True)
    for feeder in feeders:
        if feeder.table in free:
            return feeder.table
    if match.table in free:
        return match.table
    return free[0]


def waiting_matches(
    matches: Sequence[PlanMatch], window: int | None = DEFAULT_WINDOW, key: SortKey = first_come_first_served
) -> list[PlanMatch]:
    """Ready matches without a table that may get one now, next first."""
    open_rounds = [m.round for m in matches if not m.finished]
    lowest = min(open_rounds) if open_rounds else None
    candidates = [
        m
        for m in matches
        if m.ready
        and not m.finished
        and not m.playing
        and (window is None or lowest is None or m.round <= lowest + window)
    ]
    return sorted(candidates, key=key)


def assign_free_tables(
    matches: Sequence[PlanMatch],
    tables: Sequence[TableId],
    window: int | None = DEFAULT_WINDOW,
    key: SortKey = first_come_first_served,
) -> dict[MatchId, TableId]:
    """The matches at a table now: the ones already playing plus ready ones that get a free table."""
    # a match whose table is gone is not playing any more: it waits for a table like the others
    matches = [replace(m, playing=False) if m.playing and m.table not in tables else m for m in matches]
    by_id = {m.id: m for m in matches}
    playing = {m.id: m.table for m in matches if m.playing and not m.finished}
    free = [t for t in tables if t not in playing.values()]
    for match in waiting_matches(matches, window, key):
        if not free:
            break
        if match.id in playing:
            continue
        table = _preferred_table(match, by_id, free)
        playing[match.id] = table
        free.remove(table)
    return playing


def plan(
    matches: Sequence[PlanMatch],
    tables: Sequence[TableId],
    window: int | None = DEFAULT_WINDOW,
    key: SortKey = first_come_first_served,
) -> TablePlan:
    """The matches at a table now, and the queue of the other ready matches (also those the window holds back)."""
    playing = assign_free_tables(matches, tables, window, key)
    rest = [m for m in matches if m.ready and not m.finished and m.id not in playing]
    held = waiting_matches([replace(m, playing=m.id in playing) for m in matches], None, key)
    order = {m.id: i for i, m in enumerate(held)}
    queue = sorted((m.id for m in rest), key=lambda mid: order.get(mid, len(order)))
    return TablePlan(playing=playing, queue=queue)
