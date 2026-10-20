"""A team can always be renamed; tournaments that started keep the old name. Deleting says what stands in the way."""
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from tests.helpers import PLAYS, won

FUTURE = "2099-12-31T20:00:00Z"


async def _login(client: AsyncClient, n: int) -> dict:
    phone = f"+4915300000{n:02d}"
    await client.post("/auth/request-code", json={"phone_number": phone})
    token = (await client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class Ctx:
    def __init__(self, client, admin, players, team_ids, tid):
        self.client, self.admin, self.players, self.team_ids, self.tid = client, admin, players, team_ids, tid

    async def tournament_names(self) -> list[str]:
        resp = await self.client.get(f"/tournaments/{self.tid}/teams", headers=self.admin)
        return sorted(t["name"] for t in resp.json())

    async def rename(self, name: str):
        return await self.client.patch(f"/teams/{self.team_ids[0]}", json={"name": name}, headers=self.players[0])

    async def delete(self):
        return await self.client.delete(f"/teams/{self.team_ids[0]}", headers=self.players[0])

    async def my_team(self) -> dict:
        teams = (await self.client.get("/teams", headers=self.players[0])).json()
        return next(t for t in teams if t["id"] == self.team_ids[0])

    async def start(self):
        assert (await self.client.post(f"/tournaments/{self.tid}/start", headers=self.admin)).status_code == 200

    async def finish(self):
        final = (await self.client.get(f"/tournaments/{self.tid}/bracket", headers=self.admin)).json()["matches"][0]
        resp = await self.client.post(
            f"/matches/{final['id']}/results", json=won(final, final["team_a_id"], 2), headers=self.admin
        )
        assert resp.status_code == 201


@pytest_asyncio.fixture
async def ctx(async_client: AsyncClient) -> Ctx:
    """Two complete teams registered for a tournament that has not started."""
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        admin = await _login(async_client, 0)
        players = [await _login(async_client, i) for i in range(1, 5)]
    tid = (await async_client.post("/tournaments", json={**PLAYS, "name": "Cup", "start_time": FUTURE}, headers=admin)).json()["id"]
    team_ids = []
    for i, name in enumerate(["Alpha", "Bravo"]):
        creator, joiner = players[2 * i], players[2 * i + 1]
        team_id = (await async_client.post("/teams", json={"name": name}, headers=creator)).json()["id"]
        token = (await async_client.post(f"/teams/{team_id}/invite", headers=creator)).json()["token"]
        await async_client.post(f"/teams/join/{token}", headers=joiner)
        assert (await async_client.post(f"/tournaments/{tid}/join", json={"team_id": team_id}, headers=creator)).status_code == 201
        team_ids.append(team_id)
    return Ctx(async_client, admin, players, team_ids, tid)


@pytest.mark.asyncio
async def test_before_the_start_a_new_name_shows_in_the_tournament(ctx: Ctx):
    assert (await ctx.rename("Alpha Neu")).status_code == 200
    assert await ctx.tournament_names() == ["Alpha Neu", "Bravo"]


@pytest.mark.asyncio
async def test_a_started_tournament_keeps_the_name_the_team_had_then(ctx: Ctx):
    await ctx.start()

    assert (await ctx.rename("Alpha Neu")).status_code == 200  # also while it runs

    assert await ctx.tournament_names() == ["Alpha", "Bravo"]
    assert (await ctx.my_team())["name"] == "Alpha Neu"
    mine = (await ctx.client.get("/tournaments/me", headers=ctx.players[0])).json()["participating"]
    assert [p["team"]["name"] for p in mine] == ["Alpha"]


@pytest.mark.asyncio
async def test_a_registered_team_cannot_be_deleted_and_learns_why(ctx: Ctx):
    blockers = (await ctx.my_team())["delete_blockers"]
    assert [(b["tournament_name"], b["running"], b["registration_open"]) for b in blockers] == [("Cup", False, True)]

    resp = await ctx.delete()

    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert "angemeldet" in detail
    assert "Melde es dort ab" in detail


@pytest.mark.asyncio
async def test_a_team_playing_cannot_be_deleted_until_the_tournament_is_over(ctx: Ctx):
    await ctx.start()
    resp = await ctx.delete()
    assert resp.status_code == 409
    assert "spielt gerade" in resp.json()["detail"]

    await ctx.finish()

    assert (await ctx.my_team())["delete_blockers"] == []
    assert (await ctx.delete()).status_code == 204
    # the finished tournament keeps the team
    assert await ctx.tournament_names() == ["Alpha", "Bravo"]


# -- my part in the list of my tournaments --------------------------------------------------------------------------


async def _mine(ctx: Ctx, player: int) -> dict:
    return (await ctx.client.get("/tournaments/me", headers=ctx.players[player])).json()["participating"][0]


@pytest.mark.asyncio
async def test_my_tournaments_carry_the_next_match_and_at_the_end_the_place(ctx: Ctx):
    before = await _mine(ctx, 0)
    assert (before["is_checked_in"], before["next_match"], before["place"]) == (False, None, None)

    await ctx.start()
    running = await _mine(ctx, 0)
    assert running["next_match"]["status"] == "ready"
    assert running["next_match"]["table_name"] == "Tisch 1"

    await ctx.finish()  # team a of the final wins
    final = (await ctx.client.get(f"/tournaments/{ctx.tid}/bracket", headers=ctx.admin)).json()["matches"][0]
    winner = 0 if final["team_a_id"] == ctx.team_ids[0] else 2
    assert ((await _mine(ctx, winner))["place"], (await _mine(ctx, 2 - winner))["place"]) == (1, 2)
    assert (await _mine(ctx, 0))["next_match"] is None
