"""Role assignment / revocation hierarchy (Admin > Manager > Referee)."""
from unittest.mock import patch
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from tests.helpers import PLAYS


class Ctx:
    def __init__(self, client: AsyncClient, tournament_id: str, headers: list[dict], ids: list[str]):
        self.client, self.tid, self.headers, self.ids = client, tournament_id, headers, ids

    async def assign(self, actor: int, target: int | str, role: str):
        user_id = target if isinstance(target, str) else self.ids[target]
        return await self.client.post(
            f"/tournaments/{self.tid}/roles",
            json={"user_id": user_id, "role": role},
            headers=self.headers[actor],
        )

    async def revoke(self, actor: int, role_id: str):
        return await self.client.delete(f"/tournaments/{self.tid}/roles/{role_id}", headers=self.headers[actor])


@pytest_asyncio.fixture
async def ctx(async_client: AsyncClient) -> Ctx:
    """Users 0..3; user 0 is the tournament admin."""
    headers, ids = [], []
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        for i in range(4):
            phone = f"+4915200000{i:02d}"
            await async_client.post("/auth/request-code", json={"phone_number": phone})
            token = (await async_client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})).json()[
                "access_token"
            ]
            headers.append({"Authorization": f"Bearer {token}"})
            ids.append((await async_client.get("/users/me", headers=headers[i])).json()["id"])
    tid = (
        await async_client.post(
            "/tournaments", json={**PLAYS, "name": "Cup", "start_time": "2026-12-31T20:00:00Z"}, headers=headers[0]
        )
    ).json()["id"]
    return Ctx(async_client, tid, headers, ids)


@pytest.mark.asyncio
async def test_admin_assigns_and_lists_roles(ctx: Ctx):
    resp = await ctx.assign(0, 1, "manager")
    assert resp.status_code == 201
    assert resp.json()["role"] == "manager"

    roles = (await ctx.client.get(f"/tournaments/{ctx.tid}/roles", headers=ctx.headers[0])).json()
    assert {(r["user_id"], r["role"]) for r in roles} == {(ctx.ids[0], "admin"), (ctx.ids[1], "manager")}


@pytest.mark.asyncio
async def test_nobody_is_made_admin_it_is_who_created_the_tournament(ctx: Ctx):
    resp = await ctx.assign(0, 1, "admin")
    assert resp.status_code == 403
    assert "erstellt" in resp.json()["detail"]
    admin_role = next(
        r for r in (await ctx.client.get(f"/tournaments/{ctx.tid}/roles", headers=ctx.headers[0])).json()
        if r["role"] == "admin"
    )
    assert (await ctx.revoke(0, admin_role["id"])).status_code == 403, "the admin role cannot be taken away"


@pytest.mark.asyncio
async def test_manager_may_only_assign_referee(ctx: Ctx):
    await ctx.assign(0, 1, "manager")
    assert (await ctx.assign(1, 2, "referee")).status_code == 201
    assert (await ctx.assign(1, 3, "manager")).status_code == 403


@pytest.mark.asyncio
async def test_referee_and_outsider_cannot_assign(ctx: Ctx):
    await ctx.assign(0, 1, "referee")
    assert (await ctx.assign(1, 2, "referee")).status_code == 403
    assert (await ctx.assign(3, 2, "referee")).status_code == 403


@pytest.mark.asyncio
async def test_duplicate_role_and_unknown_user_are_rejected(ctx: Ctx):
    assert (await ctx.assign(0, 1, "referee")).status_code == 201
    assert (await ctx.assign(0, 1, "referee")).status_code == 403
    assert (await ctx.assign(0, str(uuid4()), "referee")).status_code == 404


@pytest.mark.asyncio
async def test_revoke_follows_hierarchy(ctx: Ctx):
    manager = (await ctx.assign(0, 1, "manager")).json()["id"]
    referee = (await ctx.assign(1, 2, "referee")).json()["id"]

    # equal / lower rank cannot revoke upwards or sideways
    assert (await ctx.revoke(2, manager)).status_code == 403
    assert (await ctx.revoke(1, manager)).status_code == 403
    # higher rank may revoke, regardless of who assigned the role
    assert (await ctx.revoke(0, referee)).status_code == 204
    assert (await ctx.revoke(0, manager)).status_code == 204

    roles = (await ctx.client.get(f"/tournaments/{ctx.tid}/roles", headers=ctx.headers[0])).json()
    assert [r["role"] for r in roles] == ["admin"]


@pytest.mark.asyncio
async def test_revoke_unknown_role_is_404(ctx: Ctx):
    assert (await ctx.revoke(0, str(uuid4()))).status_code == 404
