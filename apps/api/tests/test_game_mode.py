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
    body = {**PLAYS, "mode": "round_robin", "name": "Cup", "start_time": FUTURE}
    assert (await async_client.post("/tournaments", json=body, headers=admin)).status_code == 422


def test_game_and_mode_are_fixed_with_the_start():
    # the bracket is drawn for them when the tournament starts
    assert {"game", "mode"} <= set(BEFORE_START_ONLY)
