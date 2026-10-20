"""Managers may do everything but delete the tournament (requirements: Rechte)."""
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from tests.helpers import PLAYS


async def _login(client: AsyncClient, phone: str) -> dict:
    await client.post("/auth/request-code", json={"phone_number": phone})
    token = (await client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def ctx(async_client: AsyncClient):
    """Admin, manager, referee and a tournament with two complete teams."""
    names = ["admin", "manager", "referee", "p1", "p2", "p3", "p4"]
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        h = {n: await _login(async_client, f"+4915400000{i:02d}") for i, n in enumerate(names)}

    tid = (
        await async_client.post(
            "/tournaments",
            json={**PLAYS, "name": "Cup", "start_time": "2026-12-31T20:00:00Z", "visibility": "public"},
            headers=h["admin"],
        )
    ).json()["id"]
    for who, role in (("manager", "manager"), ("referee", "referee")):
        uid = (await async_client.get("/users/me", headers=h[who])).json()["id"]
        await async_client.post(f"/tournaments/{tid}/roles", json={"user_id": uid, "role": role}, headers=h["admin"])

    for name, (a, b) in {"A": ("p1", "p2"), "B": ("p3", "p4")}.items():
        team = (await async_client.post("/teams", json={"name": name}, headers=h[a])).json()["id"]
        invite = (await async_client.post(f"/teams/{team}/invite", headers=h[a])).json()["token"]
        await async_client.post(f"/teams/join/{invite}", headers=h[b])
        await async_client.post(f"/tournaments/{tid}/join", json={"team_id": team}, headers=h[a])
    return async_client, h, tid


@pytest.mark.asyncio
async def test_manager_can_start(ctx):
    client, h, tid = ctx
    assert (await client.post(f"/tournaments/{tid}/start", headers=h["manager"])).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize("who", ["referee", "p1"])
async def test_referee_and_players_cannot_start(ctx, who: str):
    client, h, tid = ctx
    assert (await client.post(f"/tournaments/{tid}/start", headers=h[who])).status_code == 403


@pytest.mark.asyncio
async def test_manager_still_cannot_delete_tournament(ctx):
    client, h, tid = ctx
    assert (await client.delete(f"/tournaments/{tid}", headers=h["manager"])).status_code == 403
    assert (await client.delete(f"/tournaments/{tid}", headers=h["admin"])).status_code == 204
