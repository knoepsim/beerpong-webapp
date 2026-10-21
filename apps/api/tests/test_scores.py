"""A result is the score of both teams; the game of the tournament decides which scores are possible."""
import uuid

import pytest

from app.core.database import get_db
from app.core.exceptions import InvalidScoreError
from app.games import check_score
from app.models.tournament import Game
from app.schemas.result import ResultCreate
from main import app
from tests.helpers import generate_started_tournament

USER = uuid.uuid4()


@pytest.mark.parametrize(
    ("game", "winner", "loser", "possible"),
    [
        (Game.BEERPONG, 3, 0, True),
        (Game.BEERPONG, 10, 0, True),
        (Game.BEERPONG, 3, 1, False),  # the loser has no cups left
        (Game.BEERPONG, 0, 0, False),
        (Game.BEERPONG, 11, 0, False),
        (Game.FOOTBALL, 2, 1, True),
        (Game.FOOTBALL, 1, 0, True),
        (Game.FOOTBALL, 5, 4, True),  # after penalties
        (Game.FOOTBALL, 1, 1, False),  # a knockout match needs a winner
        (Game.FOOTBALL, 0, 2, False),
    ],
)
def test_each_game_has_its_possible_scores(game: Game, winner: int, loser: int, possible: bool):
    if possible:
        check_score(game, winner, loser)
    else:
        with pytest.raises(InvalidScoreError):
            check_score(game, winner, loser)


@pytest.mark.asyncio
async def test_the_score_is_stored_per_team_and_checked_against_the_winner():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await generate_started_tournament(db, 2)
        tournament.game = Game.FOOTBALL
        final = (await service.get_bracket(tournament.id)).matches[0]

        # the winner needs the higher score
        result = ResultCreate(winner_team_id=final.team_a_id, score_a=1, score_b=2)
        with pytest.raises(InvalidScoreError):
            await service.report_result(final.id, result, USER)

        await service.report_result(final.id, ResultCreate(winner_team_id=final.team_b_id, score_a=1, score_b=2), USER)
        match = (await service.get_bracket(tournament.id)).matches[0]
        assert (match.winner_team_id, match.score_a, match.score_b) == (final.team_b_id, 1, 2)


@pytest.mark.asyncio
async def test_a_draw_is_refused_in_football():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await generate_started_tournament(db, 2)
        tournament.game = Game.FOOTBALL
        final = (await service.get_bracket(tournament.id)).matches[0]

        result = ResultCreate(winner_team_id=final.team_a_id, score_a=2, score_b=2)
        with pytest.raises(InvalidScoreError, match="Elfmeterschießen"):
            await service.report_result(final.id, result, USER)


@pytest.mark.asyncio
async def test_in_beer_pong_the_loser_has_no_cups_left():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await generate_started_tournament(db, 2)
        final = (await service.get_bracket(tournament.id)).matches[0]

        result = ResultCreate(winner_team_id=final.team_a_id, score_a=3, score_b=1)
        with pytest.raises(InvalidScoreError):
            await service.report_result(final.id, result, USER)
