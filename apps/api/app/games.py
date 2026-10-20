"""Everything that differs from game to game: possible scores, what its stations are called and which modes it has.

A result is always the score of both teams (score_a, score_b) and its winner. What a score means is up to the game:
for beer pong the cups a team had left (the loser always has none), for football the goals. The same game rules
live in the web app (components/games).
"""
from collections.abc import Callable
from dataclasses import dataclass

from app.core.exceptions import InvalidScoreError
from app.models.tournament import Game, TournamentMode

# (score of the winner, score of the loser) -> the message why it is not possible, None if it is
ScoreRule = Callable[[int, int], str | None]


@dataclass(frozen=True)
class StationTerms:
    """The word for a station of the game ("Tisch", "Platz") in the forms the texts need."""

    singular: str
    plural: str
    # with its indefinite article in the accusative and negated: "einen Tisch", "keinen Tisch"
    accusative: str
    none: str

    def numbered(self, n: int) -> str:
        """The default name of the n-th station: "Tisch 3", "Platz 3"."""
        return f"{self.singular} {n}"


@dataclass(frozen=True)
class GameRules:
    label: str
    score: ScoreRule
    station: StationTerms
    # the modes a tournament of this game can have
    modes: tuple[TournamentMode, ...]


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


GAMES: dict[Game, GameRules] = {
    Game.BEERPONG: GameRules(
        label="Bierpong",
        score=_beerpong,
        station=StationTerms(singular="Tisch", plural="Tische", accusative="einen Tisch", none="keinen Tisch"),
        modes=(TournamentMode.SINGLE_ELIMINATION,),
    ),
    Game.FOOTBALL: GameRules(
        label="Fußball",
        score=_football,
        station=StationTerms(singular="Platz", plural="Plätze", accusative="einen Platz", none="keinen Platz"),
        modes=(TournamentMode.SINGLE_ELIMINATION,),
    ),
}


def check_score(game: Game, winner_score: int, loser_score: int) -> None:
    """Raise if the score is not possible in this game (or does not fit the winner)."""
    problem = GAMES[game].score(winner_score, loser_score)
    if problem:
        raise InvalidScoreError(problem)


def stations_of(game: Game) -> StationTerms:
    return GAMES[game].station
