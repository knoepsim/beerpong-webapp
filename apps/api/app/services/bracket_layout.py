"""Pure layout logic for single-elimination brackets (no database)."""
import math
from collections.abc import Sequence
from uuid import UUID


def bracket_size(num_teams: int) -> int:
    """Smallest power of two that holds all teams."""
    return 2 ** math.ceil(math.log2(num_teams))


def seed_order(size: int) -> list[int]:
    """Standard bracket seed positions, e.g. 8 -> [1, 8, 4, 5, 2, 7, 3, 6].

    Consecutive pairs are the first-round matches. Seed s always meets seed size+1-s, so with
    fewer teams than slots the missing seeds (byes) are paired with the top seeds, are spread
    evenly over the bracket and never meet each other.
    """
    order = [1]
    while len(order) < size:
        total = len(order) * 2
        order = [seed for s in order for seed in (s, total + 1 - s)]
    return order


def round_one_pairings(team_ids: Sequence[UUID]) -> list[tuple[UUID | None, UUID | None]]:
    """First-round pairings for already shuffled teams, one entry per first-round position.

    A pairing with `None` is a bye: that team advances to round two without a match.
    """
    num_teams = len(team_ids)
    if num_teams < 2:
        raise ValueError("At least 2 teams are required to generate a bracket")

    order = seed_order(bracket_size(num_teams))

    def team_for(seed: int) -> UUID | None:
        return team_ids[seed - 1] if seed <= num_teams else None

    return [(team_for(order[i]), team_for(order[i + 1])) for i in range(0, len(order), 2)]
