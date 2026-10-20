"""Which match is played at which station: pure planning logic (no database), shared by the server and the simulation.

The rules, chosen with scripts/simulate_stations.py (16-64 teams, 3-16 stations, random match lengths):

- A station plays one match at a time and becomes free when the result of its match is entered.
- A match can go to a station once both teams are known ("ready"). Ready matches get free stations **in the order in
  which they became ready** (first come, first served), ties by round and position. Long and short matches mix
  freely: whoever is ready takes the next free station, also from a later round, so several rounds run at once.
- **Round window:** a match more than `window` rounds ahead of the lowest round that still has an open match waits.
  In a knock-out bracket first come, first served keeps the rounds close anyway; the window only matters when single
  matches drag on, and then it shortens the waits at the end a little. Waiting round by round (window 0) makes the
  tournament 10-20 % longer and the waits much longer, so it is no option.
- **Winner stays:** a match takes the station of its feeder that finished last (that team is still sitting there),
  else its own earlier station (a reopened match), else the first free station.
- A station is only decided when a match actually goes to it. Fixing stations for later matches in advance makes the
  tournament 15-25 % longer (a station would stay empty while its match is not ready yet), and a predicted station for a
  later match is right only every third to fifth time. What can be told reliably is the place in the queue: with
  first come, first served it never gets worse.
"""
from collections.abc import Callable, Hashable, Sequence
from dataclasses import dataclass, field, replace

MatchId = Hashable
StationId = Hashable

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
    station: StationId | None = None  # the station it is played at (playing) or was played at (finished, reopened)
    playing: bool = False


SortKey = Callable[[PlanMatch], tuple]


def first_come_first_served(match: PlanMatch) -> tuple:
    ready_at = match.ready_at if match.ready_at is not None else float("inf")
    return (ready_at, match.round, match.position)


@dataclass
class StationPlan:
    """The matches at a station now and the order in which the other ready matches will get one."""

    playing: dict[MatchId, StationId] = field(default_factory=dict)
    # ready matches without a station, next first: their place in the queue (a later ready match may join behind)
    queue: list[MatchId] = field(default_factory=list)


def _preferred_station(match: PlanMatch, by_id: dict[MatchId, PlanMatch], free: list[StationId]) -> StationId:
    feeders = [by_id[f] for f in match.feeders if f in by_id and by_id[f].finished and by_id[f].station is not None]
    feeders.sort(key=lambda f: f.finished_at if f.finished_at is not None else float("-inf"), reverse=True)
    for feeder in feeders:
        if feeder.station in free:
            return feeder.station
    if match.station in free:
        return match.station
    return free[0]


def waiting_matches(
    matches: Sequence[PlanMatch], window: int | None = DEFAULT_WINDOW, key: SortKey = first_come_first_served
) -> list[PlanMatch]:
    """Ready matches without a station that may get one now, next first."""
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


def assign_free_stations(
    matches: Sequence[PlanMatch],
    stations: Sequence[StationId],
    window: int | None = DEFAULT_WINDOW,
    key: SortKey = first_come_first_served,
) -> dict[MatchId, StationId]:
    """The matches at a station now: the ones already playing plus ready ones that get a free station."""
    # a match whose station is gone is not playing any more: it waits for a station like the others
    matches = [replace(m, playing=False) if m.playing and m.station not in stations else m for m in matches]
    by_id = {m.id: m for m in matches}
    playing = {m.id: m.station for m in matches if m.playing and not m.finished}
    free = [t for t in stations if t not in playing.values()]
    for match in waiting_matches(matches, window, key):
        if not free:
            break
        if match.id in playing:
            continue
        station = _preferred_station(match, by_id, free)
        playing[match.id] = station
        free.remove(station)
    return playing


def plan(
    matches: Sequence[PlanMatch],
    stations: Sequence[StationId],
    window: int | None = DEFAULT_WINDOW,
    key: SortKey = first_come_first_served,
) -> StationPlan:
    """The matches at a station now, and the queue of the other ready matches (also those the window holds back)."""
    playing = assign_free_stations(matches, stations, window, key)
    rest = [m for m in matches if m.ready and not m.finished and m.id not in playing]
    held = waiting_matches([replace(m, playing=m.id in playing) for m in matches], None, key)
    order = {m.id: i for i, m in enumerate(held)}
    queue = sorted((m.id for m in rest), key=lambda mid: order.get(mid, len(order)))
    return StationPlan(playing=playing, queue=queue)


def certain_next_stations(
    matches: Sequence[PlanMatch],
    stations: Sequence[StationId],
    now: float,
    window: int | None = DEFAULT_WINDOW,
    key: SortKey = first_come_first_served,
) -> dict[MatchId, StationId]:
    """Stations of matches still waiting for a team that are already certain (only then, never a guess).

    That is the case towards the end: there are at least as many stations as open matches and nothing queues, so
    nobody competes for a station. A match that only waits for one more feeder, which is at its station, gets what the
    planner would decide if that feeder ended now (usually its station: the winner stays). With a queue the next free
    station goes to the queue first, so nothing is said then.
    """
    open_matches = [m for m in matches if not m.finished]
    if len(stations) < len(open_matches) or plan(matches, stations, window, key).queue:
        return {}
    by_id = {m.id: m for m in matches}
    certain: dict[MatchId, StationId] = {}
    for match in open_matches:
        if match.ready:
            continue
        missing = [by_id[f] for f in match.feeders if f in by_id and not by_id[f].finished]
        if len(missing) != 1 or not missing[0].playing:
            continue
        feeder = missing[0]
        what_if = [
            replace(m, finished=True, finished_at=now, playing=False)
            if m.id == feeder.id
            else replace(m, ready=True, ready_at=now)
            if m.id == match.id
            else m
            for m in matches
        ]
        station = assign_free_stations(what_if, stations, window, key).get(match.id)
        if station is not None:
            certain[match.id] = station
    return certain
