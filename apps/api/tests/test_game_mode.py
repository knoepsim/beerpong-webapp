"""What is played and how: chosen when the tournament is created, fixed with its start."""
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.services.tournament_service import BEFORE_START_ONLY
from tests.helpers import PLAYS

FUTURE = "2099-12-31T20:00:00Z"


async def _admin(client: AsyncClient) -> dict:
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        await client.post("/auth/request-code", json={"phone_number": "+491510000099"})
        resp = await client.post("/auth/verify", json={"phone_number": "+491510000099", "code": "123456"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.mark.asyncio
@pytest.mark.parametrize("missing", ["game", "mode"])
async def test_game_and_mode_have_to_be_chosen(async_client: AsyncClient, missing: str):
    admin = await _admin(async_client)
    body = {**PLAYS, "name": "Cup", "start_time": FUTURE}
    del body[missing]
    resp = await async_client.post("/tournaments", json=body, headers=admin)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_game_and_mode_are_stored_and_returned(async_client: AsyncClient):
    admin = await _admin(async_client)
    resp = await async_client.post("/tournaments", json={**PLAYS, "name": "Cup", "start_time": FUTURE}, headers=admin)
    assert resp.status_code == 201, resp.text
    assert resp.json()["game"] == "beerpong"
    assert resp.json()["mode"] == "single_elimination"


@pytest.mark.asyncio
async def test_a_mode_that_is_not_there_yet_is_refused(async_client: AsyncClient):
    admin = await _admin(async_client)
    body = {**PLAYS, "mode": "swiss", "name": "Cup", "start_time": FUTURE}
    assert (await async_client.post("/tournaments", json=body, headers=admin)).status_code == 422


def test_game_and_mode_are_fixed_with_the_start():
    # the bracket is drawn for them when the tournament starts
    assert {"game", "mode"} <= set(BEFORE_START_ONLY)


@pytest.mark.asyncio
async def test_the_stations_are_named_by_the_game_and_follow_a_change_of_game(async_client: AsyncClient):
    admin = await _admin(async_client)
    body = {**PLAYS, "game": "football", "name": "Kick", "start_time": FUTURE, "station_count": 2}
    tid = (await async_client.post("/tournaments", json=body, headers=admin)).json()["id"]
    stations = await async_client.get(f"/tournaments/{tid}/stations", headers=admin)
    assert [s["name"] for s in stations.json()] == ["Platz 1", "Platz 2"]

    # a name the organizers gave stays, the numbered ones get the word of the new game
    first = stations.json()[0]["id"]
    await async_client.patch(f"/tournaments/{tid}/stations/{first}", json={"name": "Hauptfeld"}, headers=admin)
    assert (await async_client.patch(f"/tournaments/{tid}", json={"game": "beerpong"}, headers=admin)).status_code == 200
    names = [s["name"] for s in (await async_client.get(f"/tournaments/{tid}/stations", headers=admin)).json()]
    assert names == ["Hauptfeld", "Tisch 2"]
    added = await async_client.post(f"/tournaments/{tid}/stations", json={}, headers=admin)
    assert added.json()["name"] == "Tisch 3"


def test_a_mode_the_game_does_not_have_is_refused(monkeypatch):
    from app.core.exceptions import InvalidModeError
    from app.games import GAMES, GameRules
    from app.models.tournament import Game, TournamentMode
    from app.services.tournament_service import _check_mode

    rules = GAMES[Game.FOOTBALL]
    monkeypatch.setitem(GAMES, Game.FOOTBALL, GameRules(rules.label, rules.score, rules.station, modes=()))
    with pytest.raises(InvalidModeError, match="Fußball"):
        _check_mode(Game.FOOTBALL, TournamentMode.SINGLE_ELIMINATION)


@pytest.mark.asyncio
async def test_groups_need_their_numbers_and_belong_to_their_mode(async_client: AsyncClient):
    admin = await _admin(async_client)
    body = {**PLAYS, "mode": "groups_knockout", "name": "Cup", "start_time": FUTURE}
    assert (await async_client.post("/tournaments", json=body, headers=admin)).status_code == 400
    created = await async_client.post(
        "/tournaments", json={**body, "group_count": 4, "advance_per_group": 2}, headers=admin
    )
    assert (created.json()["group_count"], created.json()["advance_per_group"]) == (4, 2)
    # another mode has no groups
    tid = created.json()["id"]
    changed = await async_client.patch(f"/tournaments/{tid}", json={"mode": "round_robin"}, headers=admin)
    assert changed.json()["group_count"] is None
