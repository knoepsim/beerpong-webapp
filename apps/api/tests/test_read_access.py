"""Read endpoints of a tournament must respect its visibility."""
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient


class Ctx:
    def __init__(self, client: AsyncClient, headers: dict[str, dict], tid: str, match_id: str, invite: str):
        self.client, self.headers, self.tid, self.match_id, self.invite = client, headers, tid, match_id, invite

    def urls(self, invite: str | None = None) -> list[str]:
        q = f"?invite={invite}" if invite else ""
        return [
            f"/tournaments/{self.tid}{q}",
            f"/tournaments/{self.tid}/bracket{q}",
            f"/tournaments/{self.tid}/teams{q}",
            f"/tournaments/{self.tid}/roles{q}",
            f"/matches/{self.match_id}/results{q}",
        ]

    async def statuses(self, who: str, invite: str | None = None) -> set[int]:
        return {(await self.client.get(u, headers=self.headers[who])).status_code for u in self.urls(invite)}


async def _login(client: AsyncClient, phone: str) -> dict:
    await client.post("/auth/request-code", json={"phone_number": phone})
    token = (await client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _make_team(client: AsyncClient, creator: dict, joiner: dict, name: str) -> str:
    team_id = (await client.post("/teams", json={"name": name}, headers=creator)).json()["id"]
    token = (await client.post(f"/teams/{team_id}/invite", headers=creator)).json()["token"]
    await client.post(f"/teams/join/{token}", headers=joiner)
    return team_id


@pytest_asyncio.fixture(params=["private", "public_listed", "public_unlisted"])
async def ctx(request, async_client: AsyncClient) -> Ctx:
    """Admin, a participant (team of two), a referee and an outsider; one match exists."""
    names = ["admin", "p1", "p2", "p3", "p4", "referee", "outsider"]
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        headers = {n: await _login(async_client, f"+4915300000{i:02d}") for i, n in enumerate(names)}

    tid = (
        await async_client.post(
            "/tournaments",
            json={"name": "Cup", "start_time": "2026-12-31T20:00:00Z", "visibility": request.param},
            headers=headers["admin"],
        )
    ).json()["id"]
    invite = (await async_client.post(f"/tournaments/{tid}/invite", headers=headers["admin"])).json()["token"]

    me = (await async_client.get("/users/me", headers=headers["referee"])).json()["id"]
    await async_client.post(
        f"/tournaments/{tid}/roles", json={"user_id": me, "role": "referee"}, headers=headers["admin"]
    )

    for name, (a, b) in {"A": ("p1", "p2"), "B": ("p3", "p4")}.items():
        team_id = await _make_team(async_client, headers[a], headers[b], name)
        resp = await async_client.post(
            f"/tournaments/{tid}/join", json={"team_id": team_id, "invite_token": invite}, headers=headers[a]
        )
        assert resp.status_code == 201
    assert (await async_client.post(f"/tournaments/{tid}/start", headers=headers["admin"])).status_code == 200
    match_id = (await async_client.get(f"/tournaments/{tid}/bracket", headers=headers["admin"])).json()["matches"][0]["id"]

    c = Ctx(async_client, headers, tid, match_id, invite)
    c.visibility = request.param
    return c


@pytest.mark.asyncio
async def test_outsider_access_depends_on_visibility(ctx: Ctx):
    if ctx.visibility == "private":
        assert await ctx.statuses("outsider") == {403}
    else:
        assert await ctx.statuses("outsider") == {200}


@pytest.mark.asyncio
async def test_invite_token_grants_read_access(ctx: Ctx):
    assert await ctx.statuses("outsider", ctx.invite) == {200}
    assert await ctx.statuses("outsider", "wrong-token") == ({403} if ctx.visibility == "private" else {200})


@pytest.mark.asyncio
@pytest.mark.parametrize("who", ["admin", "referee", "p1", "p4"])
async def test_role_holders_and_participants_always_have_access(ctx: Ctx, who: str):
    assert await ctx.statuses(who) == {200}
