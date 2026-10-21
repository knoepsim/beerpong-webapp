"""Group stage and knock-out: the groups, who goes on and who meets whom in the first knock-out round.

Pure logic, no database. A group plays everybody against everybody (services/round_robin.py); the first
`advance` of every group go on into a knock-out tree (services/bracket_layout.py) whose places are named
"A1" (first of group A), "B2" (second of group B), ... until the organization starts the knock-out stage.
"""
from collections.abc import Hashable, Sequence

TeamId = Hashable


def group_letter(group: int) -> str:
    """1 -> "A", 2 -> "B", ..."""
    return chr(ord("A") + group - 1)


def place_label(group: int, rank: int) -> str:
    """The place in the knock-out tree for the team at `rank` in `group`: "A1"."""
    return f"{group_letter(group)}{rank}"


def parse_label(label: str) -> tuple[int, int]:
    """"B2" -> (2, 2)."""
    return ord(label[0]) - ord("A") + 1, int(label[1:])


def split_into_groups(team_ids: Sequence[TeamId], count: int) -> list[list[TeamId]]:
    """The (already shuffled) teams dealt out one by one: the groups differ in size by one at most."""
    return [list(team_ids[g::count]) for g in range(count)]


def size_problem(team_count: int, group_count: int, advance: int) -> str | None:
    """Why the teams do not fill the groups, or None: every group needs more teams than go on, and at least 2."""
    smallest = max(advance + 1, 2)
    if team_count < group_count * smallest:
        return (
            f"Für {group_count} Gruppen, aus denen je {advance} weiterkommen, braucht es mindestens "
            f"{group_count * smallest} Teams."
        )
    return None


def knockout_seeds(group_count: int, advance: int) -> list[str]:
    """The places in seed order (seed s meets seed n+1-s in a full first round, bracket_layout.seed_order).

    The group winners are the top seeds; the second of a group meets the winner of its partner group (A with B,
    C with D; with an odd number of groups the next one), so teams of the same group meet as late as possible.
    Further places follow group by group.
    """
    groups = range(1, group_count + 1)
    winners = [place_label(g, 1) for g in groups]
    if advance == 1:
        return winners
    total = group_count * advance
    seeds: list[str | None] = [*winners, *([None] * (total - group_count))]

    def partner(g: int) -> int:
        if group_count % 2 == 0:
            return g + 1 if g % 2 else g - 1
        return g % group_count + 1

    for i, g in enumerate(groups):
        seeds[total - 1 - i] = place_label(partner(g), 2)
    rest = [place_label(g, rank) for rank in range(3, advance + 1) for g in groups]
    free = [i for i, s in enumerate(seeds) if s is None]
    for i, label in zip(free, rest, strict=True):
        seeds[i] = label
    return [s for s in seeds if s is not None]


def open_ties(ranks: Sequence[tuple[TeamId, int]], advance: int) -> list[list[TeamId]]:
    """Teams of a group that share a rank where it matters: whether they go on, or at which place.

    `ranks` is the table in order, (team, rank). A block of equal rank matters when it reaches into the places
    that go on (rank <= advance).
    """
    blocks: dict[int, list[TeamId]] = {}
    for team, rank in ranks:
        blocks.setdefault(rank, []).append(team)
    return [teams for rank, teams in blocks.items() if len(teams) > 1 and rank <= advance]


def apply_order(ranks: Sequence[tuple[TeamId, int]], order: Sequence[TeamId] | None) -> list[TeamId]:
    """The final order of a group: the table, with the order the organization gave for teams of equal rank.

    `order` lists the teams of the group as the organization wants them; it may only change the order within a
    block of equal rank (a team that is better in the table stays better). Raises ValueError otherwise.
    """
    table = [team for team, _ in ranks]
    if not order:
        return table
    rank_of = dict(ranks)
    if sorted(map(str, order)) != sorted(map(str, table)):
        raise ValueError("Die Reihenfolge muss genau die Teams der Gruppe enthalten.")
    if any(rank_of[a] > rank_of[b] for a, b in zip(order, order[1:])):
        raise ValueError("Die Reihenfolge darf nur Teams mit gleichem Platz tauschen.")
    return list(order)
