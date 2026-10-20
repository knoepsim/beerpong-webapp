"""The rules of each game for a result: which scores are possible and how they decide the winner.

A result is always the score of both teams (score_a, score_b) and its winner. What a score means is up to the game:
for beer pong the cups a team had left (the loser always has none), for football the goals.
"""
from collections.abc import Callable

from app.core.exceptions import InvalidScoreError
from app.models.tournament import Game

# (score of the winner, score of the loser) -> the message why it is not possible, None if it is
ScoreRule = Callable[[int, int], str | None]


def _beerpong(winner: int, loser: int) -> str | None:
    if loser != 0:
        return "Beim Bierpong hat das unterlegene Team keine Becher mehr übrig."
    if not 1 <= winner <= 10:
        return "Der Sieger hat zwischen 1 und 10 Becher übrig."
    return None


def _football(winner: int, loser: int) -> str | None:
    if winner > 99:
        return "So viele Tore sind nicht möglich."
    if winner <= loser:
        # a knockout match needs a winner: extra time and penalties count into the score
        return "Der Sieger braucht mehr Tore. Trag bei Gleichstand das Ergebnis nach Verlängerung oder Elfmeterschießen ein."
    return None


RULES: dict[Game, ScoreRule] = {
    Game.BEERPONG: _beerpong,
    Game.FOOTBALL: _football,
}


def check_score(game: Game, winner_score: int, loser_score: int) -> None:
    """Raise if the score is not possible in this game (or does not fit the winner)."""
    problem = RULES[game](winner_score, loser_score)
    if problem:
        raise InvalidScoreError(problem)
