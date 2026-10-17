"""Who may join (anybody with the address / only with an invitation link) and the invitation links."""
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

FUTURE = "2099-12-31T20:00:00Z"


async def _login(client: AsyncClient, n: int) -> dict:
    phone = f"+4915400000{n:02d}"
    await client.post("/auth/request-code", json={"phone_number": phone})
    token = (await client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class Ctx:
    def __init__(self, client: AsyncClient, admin: dict, players: list[dict], team_ids: list[str], outsider: dict):
        self.client, self.admin, self.players, self.team_ids, self.outsider = client, admin, players, team_ids, outsider

    async def create(self, **body) -> dict:
        resp = await self.client.post(
            "/tournaments", json={"name": "Cup", "start_time": FUTURE, **body}, headers=self.admin
        )
        assert resp.status_code == 201, resp.text
        return resp.json()

    async def invites(self, tid: str) -> list[dict]:
        return (await self.client.get(f"/tournaments/{tid}/invites", headers=self.admin)).json()

    async def join(self, tid: str, team: int, token: str | None = None):
        return await self.client.post(
            f"/tournaments/{tid}/join",
            json={"team_id": self.team_ids[team], **({"invite_token": token} if token else {})},
            headers=self.players[team * 2],
        )


@pytest_asyncio.fixture
async def ctx(async_client: AsyncClient) -> Ctx:
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        admin = await _login(async_client, 0)
        players = [await _login(async_client, i) for i in range(1, 5)]
        outsider = await _login(async_client, 9)
    team_ids = []
    for i in range(2):
        team_id = (await async_client.post("/teams", json={"name": f"T{i}"}, headers=players[i * 2])).json()["id"]
        token = (await async_client.post(f"/teams/{team_id}/invite", headers=players[i * 2])).json()["token"]
        await async_client.post(f"/teams/join/{token}", headers=players[i * 2 + 1])
        team_ids.append(team_id)
    return Ctx(async_client, admin, players, team_ids, outsider)


@pytest.mark.asyncio
async def test_new_tournaments_are_public_and_open_by_default(ctx: Ctx):
    tournament = await ctx.create()
    assert (tournament["visibility"], tournament["join_policy"]) == ("public", "open")
    assert await ctx.invites(tournament["id"]) == [], "no link needed while everybody may join"


@pytest.mark.asyncio
async def test_anybody_may_join_an_open_tournament_even_a_private_one(ctx: Ctx):
    for visibility in ("public", "private"):
        tournament = await ctx.create(visibility=visibility, join_policy="open")
        assert (await ctx.join(tournament["id"], 0)).status_code == 201
        # joined, so the participant sees what a private tournament hides from strangers
        assert (await ctx.client.get(f"/tournaments/{tournament['id']}/bracket", headers=ctx.players[0])).status_code == 200


@pytest.mark.asyncio
async def test_an_invite_only_tournament_needs_a_valid_link_of_its_own_tournament(ctx: Ctx):
    tournament = await ctx.create(join_policy="invite_only")
    other = await ctx.create(join_policy="invite_only")
    link = (await ctx.invites(tournament["id"]))[0]["token"]
    other_link = (await ctx.invites(other["id"]))[0]["token"]

    for token in (None, "nope123", other_link):
        resp = await ctx.join(tournament["id"], 0, token)
        assert (resp.status_code, resp.json()["error_code"]) == (403, "INVITE_REQUIRED")
    assert (await ctx.join(tournament["id"], 0, link)).status_code == 201


@pytest.mark.asyncio
async def test_an_invite_only_tournament_gets_a_first_link(ctx: Ctx):
    created = await ctx.create(join_policy="invite_only")
    assert len(await ctx.invites(created["id"])) == 1

    open_one = await ctx.create()
    await ctx.client.patch(f"/tournaments/{open_one['id']}", json={"join_policy": "invite_only"}, headers=ctx.admin)
    assert len(await ctx.invites(open_one["id"])) == 1
    await ctx.client.patch(f"/tournaments/{open_one['id']}", json={"join_policy": "invite_only"}, headers=ctx.admin)
    assert len(await ctx.invites(open_one["id"])) == 1, "switching again does not add another"


@pytest.mark.asyncio
async def test_links_are_created_named_counted_and_deleted(ctx: Ctx):
    tournament = await ctx.create(join_policy="invite_only")
    tid = tournament["id"]
    created = await ctx.client.post(f"/tournaments/{tid}/invites", json={"label": " WhatsApp "}, headers=ctx.admin)
    assert created.status_code == 201
    link = created.json()
    assert len(link["token"]) == 7
    assert (link["label"], link["opened"], link["joined"], link["deleted"]) == ("WhatsApp", 0, 0, False)

    # two accounts open the link, one of them joins with the invitation it got
    for player in (ctx.players[0], ctx.players[2]):
        assert (await ctx.client.post(f"/invites/{link['token']}/accept", headers=player)).status_code == 200
    invitation = (await ctx.client.get("/invitations", headers=ctx.players[0])).json()[0]
    accepted = await ctx.client.post(
        f"/invitations/{invitation['id']}/accept", json={"team_id": ctx.team_ids[0]}, headers=ctx.players[0]
    )
    assert accepted.status_code == 200, accepted.text
    counted = {i["token"]: (i["opened"], i["joined"]) for i in await ctx.invites(tid)}
    assert counted[link["token"]] == (2, 1)

    deleted = await ctx.client.delete(f"/tournaments/{tid}/invites/{link['id']}", headers=ctx.admin)
    assert deleted.status_code == 204
    kept = next(i for i in await ctx.invites(tid) if i["token"] == link["token"])
    assert kept["deleted"] and (kept["opened"], kept["joined"]) == (2, 1), "a deleted link keeps what it brought"
    assert (await ctx.client.get(f"/invites/{link['token']}")).status_code == 404
    assert (await ctx.client.post(f"/invites/{link['token']}/accept", headers=ctx.outsider)).status_code == 404, (
        "a deleted link does not invite anybody any more"
    )
    still_open = (await ctx.client.get("/invitations", headers=ctx.players[2])).json()
    assert len(still_open) == 1, "open invitations stay when their link is deleted"
    teams = await ctx.client.get(f"/tournaments/{tid}/teams", headers=ctx.admin)
    assert len(teams.json()) == 1, "teams that joined with the link stay"


@pytest.mark.asyncio
async def test_only_organizers_manage_links(ctx: Ctx):
    tid = (await ctx.create(join_policy="invite_only"))["id"]
    link = (await ctx.invites(tid))[0]
    assert (await ctx.client.get(f"/tournaments/{tid}/invites", headers=ctx.players[0])).status_code == 403
    assert (await ctx.client.post(f"/tournaments/{tid}/invites", json={}, headers=ctx.players[0])).status_code == 403
    assert (
        await ctx.client.delete(f"/tournaments/{tid}/invites/{link['id']}", headers=ctx.players[0])
    ).status_code == 403


@pytest.mark.asyncio
async def test_a_link_shows_what_a_stranger_needs_to_decide_and_nothing_else(ctx: Ctx):
    tournament = await ctx.create(name="Sommerfest", location="Garten", visibility="private", join_policy="invite_only")
    token = (await ctx.invites(tournament["id"]))[0]["token"]

    resp = await ctx.client.get(f"/invites/{token}")  # no login

    assert resp.status_code == 200
    assert set(resp.json()) == {
        "tournament_id", "slug", "name", "location", "start_time", "registration_open", "join_policy",
        "description", "phase", "team_count", "registration_end_time",
    }, "the tournament and how many teams, nothing about who plays"
    assert resp.json()["name"] == "Sommerfest"
    assert (await ctx.client.get("/invites/unknown")).status_code == 404


@pytest.mark.asyncio
async def test_the_address_of_a_private_tournament_says_nothing_to_strangers(ctx: Ctx):
    secret = await ctx.create(name="Geheim", visibility="private", join_policy="invite_only")
    open_private = await ctx.create(name="Offen privat", visibility="private", join_policy="open")
    public = await ctx.create(name="Alle", visibility="public")

    for tournament, visible in ((secret, False), (open_private, False), (public, True)):
        resp = await ctx.client.get(f"/tournaments/by-slug/{tournament['slug']}", headers=ctx.outsider)
        assert (resp.status_code == 200) is visible

    # a stranger may see the preview of what he may join, but not of what needs an invitation
    assert (await ctx.client.get(f"/tournaments/by-slug/{open_private['slug']}/preview")).status_code == 200
    assert (await ctx.client.get(f"/tournaments/by-slug/{secret['slug']}/preview")).status_code == 404
    assert (await ctx.client.get(f"/tournaments/by-slug/{public['slug']}/preview")).status_code == 200


@pytest.mark.asyncio
async def test_the_public_list_of_tournaments_is_gone(ctx: Ctx):
    resp = await ctx.client.get("/tournaments", headers=ctx.admin)
    assert resp.status_code in (404, 405)


@pytest.mark.asyncio
async def test_my_tournaments_lists_what_i_play_and_what_i_organize(ctx: Ctx):
    organized = await ctx.create(name="Meins")
    played = await ctx.create(name="Mitgespielt")
    assert (await ctx.join(played["id"], 0)).status_code == 201

    mine = await ctx.client.get("/tournaments/me", headers=ctx.admin)
    assert mine.status_code == 200
    assert {t["tournament"]["id"] for t in mine.json()["managing"]} == {organized["id"], played["id"]}

    players = await ctx.client.get("/tournaments/me", headers=ctx.players[0])
    assert players.status_code == 200
    participating = players.json()["participating"]
    assert [t["tournament"]["id"] for t in participating] == [played["id"]]
    assert participating[0]["team"]["id"] == ctx.team_ids[0]


@pytest.mark.asyncio
async def test_my_tournaments_lists_where_i_am_a_referee(ctx: Ctx):
    tournament = await ctx.create(name="Pfeifen")
    referee = (await ctx.client.get("/users/me", headers=ctx.players[0])).json()["id"]
    resp = await ctx.client.post(
        f"/tournaments/{tournament['id']}/roles", json={"user_id": referee, "role": "referee"}, headers=ctx.admin
    )
    assert resp.status_code == 201

    mine = (await ctx.client.get("/tournaments/me", headers=ctx.players[0])).json()["managing"]

    assert [(t["tournament"]["id"], t["role"]) for t in mine] == [(tournament["id"], "referee")]
