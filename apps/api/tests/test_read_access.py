"""Read endpoints of a tournament must respect its visibility."""
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from tests.helpers import PLAYS


class Ctx:
    def __init__(self, client: AsyncClient, headers: dict[str, dict], tid: str, match_id: str):
        self.client, self.headers, self.tid, self.match_id = client, headers, tid, match_id

    def urls(self) -> list[str]:
        return [
            f"/tournaments/{self.tid}",
            f"/tournaments/{self.tid}/bracket",
            f"/tournaments/{self.tid}/teams",
            f"/tournaments/{self.tid}/roles",
            f"/matches/{self.match_id}/results",
        ]

    async def statuses(self, who: str) -> set[int]:
        return {(await self.client.get(u, headers=self.headers[who])).status_code for u in self.urls()}

    async def anonymous_statuses(self) -> set[int]:
        return {(await self.client.get(u)).status_code for u in self.urls()}


async def _login(client: AsyncClient, phone: str) -> dict:
    await client.post("/auth/request-code", json={"phone_number": phone})
    token = (await client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _make_team(client: AsyncClient, creator: dict, joiner: dict, name: str) -> str:
    team_id = (await client.post("/teams", json={"name": name}, headers=creator)).json()["id"]
    token = (await client.post(f"/teams/{team_id}/invite", headers=creator)).json()["token"]
    await client.post(f"/teams/join/{token}", headers=joiner)
    return team_id


@pytest_asyncio.fixture(params=["private", "public"])
async def ctx(request, async_client: AsyncClient) -> Ctx:
    """Admin, a participant (team of two), a referee and an outsider; one match exists."""
    names = ["admin", "p1", "p2", "p3", "p4", "referee", "outsider"]
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        headers = {n: await _login(async_client, f"+4915300000{i:02d}") for i, n in enumerate(names)}

    tid = (
        await async_client.post(
            "/tournaments",
            json={**PLAYS, "name": "Cup", "start_time": "2026-12-31T20:00:00Z", "visibility": request.param},
            headers=headers["admin"],
        )
    ).json()["id"]

    me = (await async_client.get("/users/me", headers=headers["referee"])).json()["id"]
    await async_client.post(
        f"/tournaments/{tid}/roles", json={"user_id": me, "role": "referee"}, headers=headers["admin"]
    )

    for name, (a, b) in {"A": ("p1", "p2"), "B": ("p3", "p4")}.items():
        team_id = await _make_team(async_client, headers[a], headers[b], name)
        resp = await async_client.post(
            f"/tournaments/{tid}/join", json={"team_id": team_id}, headers=headers[a]
        )
        assert resp.status_code == 201
    assert (await async_client.post(f"/tournaments/{tid}/start", headers=headers["admin"])).status_code == 200
    match_id = (await async_client.get(f"/tournaments/{tid}/bracket", headers=headers["admin"])).json()["matches"][0]["id"]

    c = Ctx(async_client, headers, tid, match_id)
    c.visibility = request.param
    return c


@pytest.mark.asyncio
async def test_outsider_access_depends_on_visibility(ctx: Ctx):
    if ctx.visibility == "private":
        assert await ctx.statuses("outsider") == {403}
    else:
        assert await ctx.statuses("outsider") == {200}


@pytest.mark.asyncio
async def test_an_invitation_link_does_not_open_the_results_of_a_private_tournament(ctx: Ctx):
    """An invitation lets somebody join; what they may see is decided by the visibility."""
    token = (await ctx.client.post(f"/tournaments/{ctx.tid}/invites", json={}, headers=ctx.headers["admin"])).json()["token"]
    assert (await ctx.client.get(f"/invites/{token}")).status_code == 200
    expected = {403} if ctx.visibility == "private" else {200}
    assert await ctx.statuses("outsider") == expected


@pytest.mark.asyncio
@pytest.mark.parametrize("who", ["admin", "referee", "p1", "p4"])
async def test_role_holders_and_participants_always_have_access(ctx: Ctx, who: str):
    assert await ctx.statuses(who) == {200}


@pytest.mark.asyncio
async def test_without_login_only_public_tournaments_can_be_read(ctx: Ctx):
    expected = {403} if ctx.visibility == "private" else {200}
    assert await ctx.anonymous_statuses() == expected


@pytest.mark.asyncio
async def test_strangers_see_team_names_but_not_the_players_nor_the_helpers(ctx: Ctx):
    if ctx.visibility == "private":
        pytest.skip("private tournaments are not readable for strangers at all")
    for headers in ({}, ctx.headers["outsider"]):
        teams = (await ctx.client.get(f"/tournaments/{ctx.tid}/teams", headers=headers)).json()
        assert sorted(t["name"] for t in teams) == ["A", "B"]
        assert all(t["members"] == [] for t in teams)
        assert (await ctx.client.get(f"/tournaments/{ctx.tid}/roles", headers=headers)).json() == []

    # the players see each other and the helpers
    teams = (await ctx.client.get(f"/tournaments/{ctx.tid}/teams", headers=ctx.headers["p1"])).json()
    assert all(len(t["members"]) == 2 for t in teams)
    assert len((await ctx.client.get(f"/tournaments/{ctx.tid}/roles", headers=ctx.headers["p1"])).json()) >= 2


@pytest.mark.asyncio
async def test_strangers_do_not_learn_who_entered_a_result(ctx: Ctx):
    if ctx.visibility == "private":
        pytest.skip("private tournaments are not readable for strangers at all")
    bracket = (await ctx.client.get(f"/tournaments/{ctx.tid}/bracket")).json()
    match = bracket["matches"][0]
    resp = await ctx.client.post(
        f"/matches/{match['id']}/results",
        json={"winner_team_id": match["team_a_id"], "cups_left": 3},
        headers=ctx.headers["referee"],
    )
    assert resp.status_code == 201, resp.text

    stranger = (await ctx.client.get(f"/matches/{match['id']}/results")).json()
    involved = (await ctx.client.get(f"/matches/{match['id']}/results", headers=ctx.headers["p1"])).json()
    assert stranger[0]["reported_by_username"] is None
    assert involved[0]["reported_by_username"] is not None


@pytest.mark.asyncio
async def test_a_wrong_or_stale_token_makes_somebody_a_stranger_not_an_error(ctx: Ctx):
    expected = {403} if ctx.visibility == "private" else {200}
    resp = await ctx.client.get(f"/tournaments/{ctx.tid}", headers={"Authorization": "Bearer not-a-token"})
    assert resp.status_code in expected
