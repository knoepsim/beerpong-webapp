"""Everybody against everybody: the match days and the table. Pure logic, no database."""
from collections.abc import Hashable, Sequence
from dataclasses import dataclass

TeamId = Hashable

# a win, a draw, a defeat
POINTS = (3, 1, 0)


def match_days(team_ids: Sequence[TeamId]) -> list[list[tuple[TeamId, TeamId]]]:
    """Every pair once, spread over match days with the circle method: n-1 days for n teams (n days when n is odd,
    then one team has a break each day). Nobody plays twice on a day; who is listed first alternates."""
    teams: list[TeamId | None] = list(team_ids)
    if len(teams) % 2:
        teams.append(None)  # the break
    n = len(teams)
    days = []
    for day in range(n - 1):
        pairs = []
        for i in range(n // 2):
            a, b = teams[i], teams[n - 1 - i]
            if a is None or b is None:
                continue
            # the fixed team would always be first: alternate it, the others alternate by their place
            pairs.append((b, a) if (i == 0 and day % 2) else (a, b))
        days.append(pairs)
        teams = [teams[0], teams[-1], *teams[1:-1]]
    return days


@dataclass(frozen=True)
class Played:
    """A match with its current result as the table needs it; winner None for a draw."""

    team_a: TeamId
    team_b: TeamId
    score_a: int
    score_b: int
    winner: TeamId | None


@dataclass
class Row:
    team_id: TeamId
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    score_for: int = 0
    score_against: int = 0
    points: int = 0
    rank: int = 0

    @property
    def difference(self) -> int:
        return self.score_for - self.score_against


def _add(row: Row, own: int, other: int, outcome: int) -> None:
    row.played += 1
    row.score_for += own
    row.score_against += other
    row.points += POINTS[outcome]
    if outcome == 0:
        row.won += 1
    elif outcome == 1:
        row.drawn += 1
    else:
        row.lost += 1


def _rows(team_ids: Sequence[TeamId], results: Sequence[Played]) -> dict[TeamId, Row]:
    rows = {team: Row(team) for team in team_ids}
    for r in results:
        if r.team_a not in rows or r.team_b not in rows:
            continue
        if r.winner is None:
            outcome_a = 1
        else:
            outcome_a = 0 if r.winner == r.team_a else 2
        _add(rows[r.team_a], r.score_a, r.score_b, outcome_a)
        _add(rows[r.team_b], r.score_b, r.score_a, 2 - outcome_a)
    return rows


def standings(team_ids: Sequence[TeamId], results: Sequence[Played]) -> list[Row]:
    """The table: points, then the matches among the teams with the same points (direct comparison), then the
    difference, then the score. Teams that are equal in all of it share their rank."""
    rows = _rows(team_ids, results)

    def direct(group: list[Row]) -> dict[TeamId, tuple[int, int]]:
        ids = {row.team_id for row in group}
        among = _rows(list(ids), [r for r in results if r.team_a in ids and r.team_b in ids])
        return {team: (row.points, row.difference) for team, row in among.items()}

    by_points: dict[int, list[Row]] = {}
    for row in rows.values():
        by_points.setdefault(row.points, []).append(row)
    keys: dict[TeamId, tuple] = {}
    for group in by_points.values():
        mutual = direct(group)
        for row in group:
            keys[row.team_id] = (row.points, *mutual[row.team_id], row.difference, row.score_for)

    ordered = sorted(rows.values(), key=lambda row: keys[row.team_id], reverse=True)
    for i, row in enumerate(ordered):
        same = i > 0 and keys[row.team_id] == keys[ordered[i - 1].team_id]
        row.rank = ordered[i - 1].rank if same else i + 1
    return ordered
