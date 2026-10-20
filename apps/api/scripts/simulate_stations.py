"""Simulates tournaments to choose and check the station planning (app/services/station_planner.py).

The simulation drives the planner the server uses: matches take a random time, a station becomes free when its match
ends, the next teams need a moment to get there, and the planner decides who plays next and where. It compares the
rule the server uses with the alternatives that were considered.

Usage (from apps/api):
    uv run python -m scripts.simulate_stations
    uv run python -m scripts.simulate_stations --teams 40 --stations 3 5 7 --trials 300
    uv run python -m scripts.simulate_stations --stress     # 3 % of the matches take five times as long
"""
import argparse
import math
import random
import statistics
from collections.abc import Callable
from dataclasses import dataclass, field, replace

from app.services.bracket_layout import round_one_pairings
from app.services.station_planner import (
    DEFAULT_WINDOW,
    PlanMatch,
    assign_free_stations,
    first_come_first_served,
    plan,
)

MEDIAN_MINUTES = 12.0  # a typical beer pong match
SPREAD = 0.35  # lognormal sigma: most matches take 7-20 minutes
LONG_SHARE = 0.10  # some take much longer (overtime, slow players)
LONG_FACTOR = 1.7
WALK_MINUTES = 1.5  # from "the station is free" to "the next match starts"


def match_minutes(rng: random.Random, stress: bool) -> float:
    minutes = rng.lognormvariate(math.log(MEDIAN_MINUTES), SPREAD)
    minutes *= LONG_FACTOR if rng.random() < LONG_SHARE else 1.0
    if stress and rng.random() < 0.03:
        minutes *= 5
    return minutes


@dataclass
class SimMatch:
    plan: PlanMatch
    next_id: str | None = None
    teams: list[int] = field(default_factory=list)


def build_bracket(num_teams: int) -> dict[str, SimMatch]:
    """The match tree the server draws (a bye gives no match), with feeders instead of database links."""
    pairings = round_one_pairings(list(range(num_teams)))
    total_rounds = int(math.log2(len(pairings))) + 1
    matches: dict[str, SimMatch] = {}
    slots: dict[tuple[int, int], str | None] = {}
    byes = {pos: (a if a is not None else b) for pos, (a, b) in enumerate(pairings) if a is None or b is None}
    for pos, (a, b) in enumerate(pairings):
        mid = f"1-{pos}" if pos not in byes else None
        slots[(1, pos)] = mid
        if mid:
            matches[mid] = SimMatch(PlanMatch(mid, 1, pos, ready=True, ready_at=0.0), teams=[a, b])
    for rnd in range(2, total_rounds + 1):
        for pos in range(len(pairings) // 2 ** (rnd - 1)):
            mid, feeders, teams = f"{rnd}-{pos}", [], []
            for child in (2 * pos, 2 * pos + 1):
                child_id = slots[(rnd - 1, child)]
                if child_id is None:
                    teams.append(byes[child])
                else:
                    feeders.append(child_id)
                    matches[child_id].next_id = mid
            ready = not feeders
            matches[mid] = SimMatch(
                PlanMatch(mid, rnd, pos, feeders=tuple(feeders), ready=ready, ready_at=0.0 if ready else None),
                teams=teams,
            )
            slots[(rnd, pos)] = mid
    return matches


# -- rules -------------------------------------------------------------------------------------------------------

Decide = Callable[[list[PlanMatch], list[str], dict], dict]


def server_rule(window: int | None, key=None) -> Decide:
    """The planner of the server (optionally with another window or another order)."""

    def decide(matches, stations, _memory):
        return assign_free_stations(matches, stations, window, key or first_come_first_served)

    return decide


def opponent_waits_first(matches, stations, _memory):
    """Alternative: first the match whose winner somebody already waits for (a bye team, the other semi-final)."""
    by_id = {m.id: m for m in matches}
    parents = {f: m for m in matches for f in m.feeders}

    def key(match):
        parent = parents.get(match.id)
        waits = parent is not None and (
            len(parent.feeders) < 2 or any(by_id[f].finished for f in parent.feeders if f != match.id)
        )
        return (not waits, *first_come_first_served(match))

    return assign_free_stations(matches, stations, DEFAULT_WINDOW, key)


def fixed_stations(matches, stations, memory):
    """Alternative: a match gets its station fixed as soon as it is ready and only plays there."""
    reserved: dict = memory.setdefault("reserved", {})
    load = {t: 0 for t in stations}
    for mid, station in reserved.items():
        load[station] += 1
    for match in sorted((m for m in matches if m.ready and not m.finished), key=first_come_first_served):
        if match.id not in reserved:
            station = min(stations, key=lambda t: load[t])
            reserved[match.id] = station
            load[station] += 1
    playing = {m.id: m.station for m in matches if m.playing and not m.finished}
    for station in stations:
        if station in playing.values():
            continue
        queue = [m for m in matches if reserved.get(m.id) == station and m.ready and not m.finished and not m.playing]
        if queue:
            playing[min(queue, key=first_come_first_served).id] = station
    for mid in [m for m, t in reserved.items() if by_finished(matches, m)]:
        del reserved[mid]
    return playing


def by_finished(matches, mid) -> bool:
    return any(m.id == mid and m.finished for m in matches)


RULES: dict[str, Decide] = {
    "Server (F2)": server_rule(DEFAULT_WINDOW),
    "ohne Fenster": server_rule(None),
    "Runde für Runde": server_rule(0),
    "Fenster 1": server_rule(1),
    "Wartende zuerst": opponent_waits_first,
    "Tisch fest": fixed_stations,
}


# -- one tournament ----------------------------------------------------------------------------------------------


@dataclass
class RunResult:
    duration: float
    waits: list[float]  # between two matches of a team
    station_waits: list[float]  # part of it: both teams ready, but no (allowed) station
    first_match: float  # until the last team plays its first match
    final_wait: float  # the first finalist waits for the second
    utilization: float
    queue_right: list[bool] = field(default_factory=list)  # place in the queue when it joined = what happened


def run(num_teams: int, num_stations: int, decide: Decide, rng: random.Random, stress: bool, queues: bool) -> RunResult:
    matches = build_bracket(num_teams)
    stations = [f"T{i}" for i in range(1, num_stations + 1)]
    memory: dict = {}
    clock, events, played = 0.0, [], 0.0
    last_finish: dict[int, float] = {}
    waits, station_waits, first_starts = [], [], []
    final_wait = 0.0
    started: list[str] = []
    joined: dict[str, tuple[int, int]] = {}  # match -> (place in queue, matches started before)

    def snapshot() -> list[PlanMatch]:
        return [m.plan for m in matches.values()]

    def note_queue() -> None:
        if queues:
            for place, mid in enumerate(plan(snapshot(), stations).queue, start=1):
                joined.setdefault(mid, (place, len(started)))

    def start_matches() -> None:
        nonlocal played
        for mid, station in decide(snapshot(), stations, memory).items():
            match = matches[mid]
            if match.plan.playing:
                continue
            match.plan = replace(match.plan, playing=True, station=station)
            begin = clock + WALK_MINUTES
            started.append(mid)
            for team in match.teams:
                if team in last_finish:
                    waits.append(begin - last_finish[team])
                    station_waits.append(begin - (match.plan.ready_at or 0.0))
                else:
                    first_starts.append(begin)
            minutes = match_minutes(rng, stress)
            played += minutes
            events.append((begin + minutes, mid))

    start_matches()
    note_queue()
    while events:
        events.sort()
        clock, mid = events.pop(0)
        match = matches[mid]
        match.plan = replace(match.plan, finished=True, finished_at=clock, playing=False)
        for team in match.teams:
            last_finish[team] = clock
        if match.next_id is not None:
            follower = matches[match.next_id]
            follower.teams.append(rng.choice(match.teams))
            if all(matches[f].plan.finished for f in follower.plan.feeders):
                follower.plan = replace(follower.plan, ready=True, ready_at=clock)
                if follower.next_id is None:
                    final_wait = clock - min(matches[f].plan.finished_at for f in follower.plan.feeders)
        start_matches()
        note_queue()

    return RunResult(
        duration=clock,
        waits=waits,
        station_waits=station_waits,
        first_match=max(first_starts, default=0.0),
        final_wait=final_wait,
        utilization=played / (num_stations * clock) if clock else 0.0,
        queue_right=[started.index(mid) - before + 1 == place for mid, (place, before) in joined.items()],
    )


def p90(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(0.9 * len(ordered)))] if ordered else 0.0


def compare(teams, stations, trials, seed, stress, queues) -> None:
    columns = f"{'Teams':>5} {'Tische':>6} {'Regel':<16} {'Dauer':>5} {'Ø Warten':>8} {'p90':>4} {'max':>4} " \
              f"{'Ø Tisch':>7} {'1.Spiel':>7} {'Finale':>6} {'Auslast.':>8}" + (f" {'Platz✓':>7}" if queues else "")
    print(columns)
    print("-" * len(columns))
    for num_teams in teams:
        for num_stations in stations:
            for name, decide in RULES.items():
                rng = random.Random(seed)  # the same match lengths for every rule
                results = [run(num_teams, num_stations, decide, rng, stress, queues) for _ in range(trials)]
                waits = [w for r in results for w in r.waits]
                station_waits = [w for r in results for w in r.station_waits]
                right = [x for r in results for x in r.queue_right]
                line = (
                    f"{num_teams:>5} {num_stations:>6} {name:<16} {statistics.median(r.duration for r in results):>5.0f} "
                    f"{statistics.mean(waits):>8.1f} {p90(waits):>4.0f} "
                    f"{statistics.median(max(r.waits) for r in results):>4.0f} {statistics.mean(station_waits):>7.1f} "
                    f"{statistics.median(r.first_match for r in results):>7.0f} "
                    f"{statistics.median(r.final_wait for r in results):>6.0f} "
                    f"{statistics.mean(r.utilization for r in results):>8.0%}"
                )
                if queues:
                    line += f" {sum(right) / len(right):>7.0%}" if right else f" {'-':>7}"
                print(line)
            print()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--teams", type=int, nargs="*", default=[16, 28, 40, 64])
    parser.add_argument("--stations", type=int, nargs="*", default=[3, 5, 7, 12])
    parser.add_argument("--trials", type=int, default=200)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--stress", action="store_true", help="3 %% of the matches take five times as long")
    parser.add_argument("--queues", action="store_true", help="also check the place in the queue (slower)")
    args = parser.parse_args()
    print("Minuten. Warten: Ende des eigenen Spiels bis zum nächsten. Ø Tisch: der Teil davon, in dem beide Teams")
    print("bereit waren. 1.Spiel: bis das letzte Team sein erstes Spiel beginnt. Finale: der erste Finalist wartet.")
    print("Platz✓: der Platz in der Warteschlange beim Einreihen stimmt.\n")
    compare(args.teams, args.stations, args.trials, args.seed, args.stress, args.queues)


if __name__ == "__main__":
    main()
