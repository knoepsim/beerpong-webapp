"""Other users only see what they need: names, never phone numbers or e-mail addresses."""
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient


async def _login(client: AsyncClient, phone: str, name: str) -> dict:
    await client.post("/auth/request-code", json={"phone_number": phone})
    token = (await client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    await client.patch("/users/me", json={"name": name, "email": f"{name.lower().replace(' ', '')}@example.com"}, headers=headers)
    return headers


@pytest_asyncio.fixture
async def users(async_client: AsyncClient):
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        return {
            "alice": await _login(async_client, "+4915500000001", "Alice Anders"),
            "bob": await _login(async_client, "+4915500000002", "Bob Berger"),
            "eve": await _login(async_client, "+4915500000003", "Eve Fremd"),
        }


@pytest.mark.asyncio
async def test_search_by_name_returns_only_id_and_name(async_client: AsyncClient, users):
    resp = await async_client.get("/users/search", params={"query": "anders"}, headers=users["eve"])
    assert resp.status_code == 200
    assert [set(u) for u in resp.json()] == [{"id", "name"}]
    assert resp.json()[0]["name"] == "Alice Anders"


@pytest.mark.asyncio
async def test_search_by_complete_phone_number_finds_exactly_that_user(async_client: AsyncClient, users):
    for query in ("+4915500000002", "0155 0000 0002"):
        resp = await async_client.get("/users/search", params={"query": query}, headers=users["eve"])
        assert [u["name"] for u in resp.json()] == ["Bob Berger"]
        assert set(resp.json()[0]) == {"id", "name"}


@pytest.mark.asyncio
@pytest.mark.parametrize("query", ["+49155", "0155000", "5500000"])
async def test_partial_phone_numbers_do_not_match(async_client: AsyncClient, users, query: str):
    resp = await async_client.get("/users/search", params={"query": query}, headers=users["eve"])
    assert resp.json() == []


@pytest.mark.asyncio
async def test_wildcards_in_search_are_literal(async_client: AsyncClient, users):
    for query in ("%%", "__"):
        resp = await async_client.get("/users/search", params={"query": query}, headers=users["eve"])
        assert resp.json() == []


@pytest.mark.asyncio
async def test_team_details_only_for_members(async_client: AsyncClient, users):
    team_id = (await async_client.post("/teams", json={"name": "Duo"}, headers=users["alice"])).json()["id"]
    invite = (await async_client.post(f"/teams/{team_id}/invite", headers=users["alice"])).json()["token"]
    await async_client.post(f"/teams/join/{invite}", headers=users["bob"])

    for member in ("alice", "bob"):
        resp = await async_client.get(f"/teams/{team_id}", headers=users[member])
        assert resp.status_code == 200
        assert set(resp.json()["members"][0]) == {"user_id", "name", "joined_at"}

    assert (await async_client.get(f"/teams/{team_id}", headers=users["eve"])).status_code == 403
