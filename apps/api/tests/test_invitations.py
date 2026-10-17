"""Personal invitations: from a link or from the organization, answered by the invited person."""
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

from tests.test_access_invites import FUTURE, Ctx, _login


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


async def _me(ctx: Ctx, headers: dict) -> dict:
    return (await ctx.client.get("/users/me", headers=headers)).json()


async def _mine(ctx: Ctx, headers: dict) -> list[dict]:
    resp = await ctx.client.get("/invitations", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _orga_list(ctx: Ctx, tid: str) -> list[dict]:
    resp = await ctx.client.get(f"/tournaments/{tid}/invitations", headers=ctx.admin)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _open_link(ctx: Ctx, tid: str, headers: dict) -> dict:
    token = (await ctx.invites(tid))[0]["token"]
    resp = await ctx.client.post(f"/invites/{token}/accept", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_a_link_puts_the_invitation_into_the_account_once(ctx: Ctx):
    tid = (await ctx.create(name="Sommerfest", join_policy="invite_only"))["id"]

    first = await _open_link(ctx, tid, ctx.players[0])
    again = await _open_link(ctx, tid, ctx.players[0])

    assert first["id"] == again["id"], "opening the link again keeps the one invitation"
    assert first["status"] == "pending"
    assert first["tournament"]["name"] == "Sommerfest"
    assert first["link_label"] == "Einladungslink"
    assert [i["id"] for i in await _mine(ctx, ctx.players[0])] == [first["id"]]
    assert await _mine(ctx, ctx.players[1]) == [], "the team mate was not invited"


@pytest.mark.asyncio
async def test_accepting_with_a_complete_team_joins_an_invite_only_tournament(ctx: Ctx):
    tid = (await ctx.create(join_policy="invite_only"))["id"]
    invitation = await _open_link(ctx, tid, ctx.players[0])

    resp = await ctx.client.post(
        f"/invitations/{invitation['id']}/accept", json={"team_id": ctx.team_ids[0]}, headers=ctx.players[0]
    )

    assert resp.status_code == 200, resp.text
    assert (resp.json()["status"], resp.json()["team_name"]) == ("accepted", "T0")
    teams = (await ctx.client.get(f"/tournaments/{tid}/teams", headers=ctx.admin)).json()
    assert [t["id"] for t in teams] == [ctx.team_ids[0]]
    assert await _mine(ctx, ctx.players[0]) == [], "an answered invitation leaves the list"
    again = await ctx.client.post(
        f"/invitations/{invitation['id']}/accept", json={"team_id": ctx.team_ids[0]}, headers=ctx.players[0]
    )
    assert again.status_code == 409


@pytest.mark.asyncio
async def test_an_incomplete_team_cannot_accept_and_the_invitation_waits(ctx: Ctx):
    tid = (await ctx.create(join_policy="invite_only"))["id"]
    alone = (await ctx.client.post("/teams", json={"name": "Solo"}, headers=ctx.outsider)).json()["id"]
    invitation = await _open_link(ctx, tid, ctx.outsider)

    resp = await ctx.client.post(
        f"/invitations/{invitation['id']}/accept", json={"team_id": alone}, headers=ctx.outsider
    )

    assert resp.status_code == 400
    assert resp.json()["error_code"] == "TEAM_NOT_COMPLETE"
    assert [i["status"] for i in await _mine(ctx, ctx.outsider)] == ["pending"]


@pytest.mark.asyncio
async def test_decline_can_be_taken_back_and_the_link_opens_it_again(ctx: Ctx):
    tid = (await ctx.create(join_policy="invite_only"))["id"]
    invitation = await _open_link(ctx, tid, ctx.players[0])

    declined = await ctx.client.post(f"/invitations/{invitation['id']}/decline", headers=ctx.players[0])
    assert declined.json()["status"] == "declined"
    assert await _mine(ctx, ctx.players[0]) == []

    undone = await ctx.client.post(f"/invitations/{invitation['id']}/reopen", headers=ctx.players[0])
    assert undone.json()["status"] == "pending"

    await ctx.client.post(f"/invitations/{invitation['id']}/decline", headers=ctx.players[0])
    reopened = await _open_link(ctx, tid, ctx.players[0])
    assert (reopened["id"], reopened["status"]) == (invitation["id"], "pending")


@pytest.mark.asyncio
async def test_the_organization_invites_a_person_directly(ctx: Ctx):
    tid = (await ctx.create(name="Winter Cup"))["id"]
    person = await _me(ctx, ctx.players[0])

    resp = await ctx.client.post(f"/tournaments/{tid}/invitations", json={"user_id": person["id"]}, headers=ctx.admin)

    assert resp.status_code == 201, resp.text
    assert (resp.json()["user_name"], resp.json()["status"], resp.json()["invite_id"]) == (person["name"], "pending", None)
    mine = await _mine(ctx, ctx.players[0])
    assert mine[0]["tournament"]["name"] == "Winter Cup"
    assert mine[0]["invited_by_name"] == (await _me(ctx, ctx.admin))["name"]
    assert mine[0]["link_label"] is None


@pytest.mark.asyncio
async def test_only_the_organization_invites_and_not_who_plays_already(ctx: Ctx):
    tid = (await ctx.create())["id"]
    person = await _me(ctx, ctx.players[0])
    by_player = await ctx.client.post(
        f"/tournaments/{tid}/invitations", json={"user_id": person["id"]}, headers=ctx.players[2]
    )
    assert by_player.status_code == 403
    assert (await ctx.client.get(f"/tournaments/{tid}/invitations", headers=ctx.players[2])).status_code == 403

    assert (await ctx.join(tid, 0)).status_code == 201
    playing = await ctx.client.post(f"/tournaments/{tid}/invitations", json={"user_id": person["id"]}, headers=ctx.admin)
    assert playing.status_code == 409
    assert playing.json()["error_code"] == "ALREADY_PARTICIPANT"


@pytest.mark.asyncio
async def test_the_organization_removes_an_open_invitation_from_the_account(ctx: Ctx):
    tid = (await ctx.create(join_policy="invite_only"))["id"]
    invitation_id = (await _open_link(ctx, tid, ctx.players[0]))["id"]

    removed = await ctx.client.delete(f"/tournaments/{tid}/invitations/{invitation_id}", headers=ctx.admin)

    assert removed.status_code == 204
    assert await _mine(ctx, ctx.players[0]) == []
    assert [i["status"] for i in await _orga_list(ctx, tid)] == ["withdrawn"]
    again = await ctx.client.delete(f"/tournaments/{tid}/invitations/{invitation_id}", headers=ctx.admin)
    assert again.status_code == 409, "only open invitations can be removed"
    accept = await ctx.client.post(
        f"/invitations/{invitation_id}/accept", json={"team_id": ctx.team_ids[0]}, headers=ctx.players[0]
    )
    assert accept.status_code == 409


@pytest.mark.asyncio
async def test_joining_otherwise_accepts_and_leaving_opens_it_again(ctx: Ctx):
    tid = (await ctx.create())["id"]
    person = await _me(ctx, ctx.players[1])  # the team mate is invited, the captain joins
    await ctx.client.post(f"/tournaments/{tid}/invitations", json={"user_id": person["id"]}, headers=ctx.admin)

    assert (await ctx.join(tid, 0)).status_code == 201
    assert [(i["status"], i["team_name"]) for i in await _orga_list(ctx, tid)] == [("accepted", "T0")]

    assert (await ctx.client.delete(f"/tournaments/{tid}/leave", headers=ctx.players[0])).status_code == 204
    assert [i["status"] for i in await _orga_list(ctx, tid)] == ["pending"]
    assert len(await _mine(ctx, ctx.players[1])) == 1


@pytest.mark.asyncio
async def test_open_invitations_lapse_when_the_registration_closes(ctx: Ctx):
    tid = (await ctx.create())["id"]
    await _invite_player_0_directly(ctx, tid)
    assert len(await _mine(ctx, ctx.players[0])) == 1

    await ctx.client.put(f"/tournaments/{tid}/registration", json={"open": False}, headers=ctx.admin)

    assert await _mine(ctx, ctx.players[0]) == [], "it cannot be accepted any more"
    assert [i["status"] for i in await _orga_list(ctx, tid)] == ["pending"], "but it is kept (for statistics)"


async def _invite_player_0_directly(ctx: Ctx, tid: str) -> None:
    person = await _me(ctx, ctx.players[0])
    await ctx.client.post(f"/tournaments/{tid}/invitations", json={"user_id": person["id"]}, headers=ctx.admin)


@pytest.mark.asyncio
async def test_nobody_reads_or_answers_an_invitation_of_somebody_else(ctx: Ctx):
    tid = (await ctx.create(join_policy="invite_only"))["id"]
    invitation_id = (await _open_link(ctx, tid, ctx.players[0]))["id"]

    assert (await ctx.client.get(f"/invitations/{invitation_id}", headers=ctx.players[2])).status_code == 404
    assert (await ctx.client.post(f"/invitations/{invitation_id}/decline", headers=ctx.players[2])).status_code == 404
    assert (await ctx.client.get(f"/invitations/{invitation_id}", headers=ctx.players[0])).status_code == 200


@pytest.mark.asyncio
async def test_the_organization_sees_where_people_came_from(ctx: Ctx):
    tid = (await ctx.create(join_policy="invite_only"))["id"]
    link = (await ctx.invites(tid))[0]
    await _open_link(ctx, tid, ctx.players[0])
    await _invite_player_0_directly(ctx, tid)  # the same person, now also directly: the link stays where they came from

    [entry] = await _orga_list(ctx, tid)
    assert entry["invite_id"] == link["id"]
    assert entry["invited_by_name"] == (await _me(ctx, ctx.admin))["name"]


@pytest.mark.asyncio
async def test_the_preview_counts_teams_and_names_a_deadline_that_closes(ctx: Ctx):
    tid = (await ctx.create(registration_end_time="2099-12-30T20:00:00Z", registration_auto_close=True))["id"]
    assert (await ctx.join(tid, 0)).status_code == 201
    invitation = await _invited_view_of_player_2(ctx, tid)

    assert invitation["tournament"]["team_count"] == 1
    assert invitation["tournament"]["registration_end_time"].startswith("2099-12-30")


async def _invited_view_of_player_2(ctx: Ctx, tid: str) -> dict:
    person = await _me(ctx, ctx.players[2])
    await ctx.client.post(f"/tournaments/{tid}/invitations", json={"user_id": person["id"]}, headers=ctx.admin)
    return (await _mine(ctx, ctx.players[2]))[0]


@pytest.mark.asyncio
async def test_search_finds_a_whole_e_mail_address_but_not_a_part(ctx: Ctx):
    await ctx.client.patch("/users/me", json={"name": "Ada", "email": "ada@example.org"}, headers=ctx.players[0])

    whole = await ctx.client.get("/users/search", params={"query": " ADA@example.org "}, headers=ctx.admin)
    part = await ctx.client.get("/users/search", params={"query": "@example.org"}, headers=ctx.admin)

    assert [u["name"] for u in whole.json()] == ["Ada"]
    assert part.json() == []


@pytest.mark.asyncio
async def test_inviting_ends_with_the_start(ctx: Ctx):
    tournament = await ctx.create(start_time=FUTURE)
    tid = tournament["id"]
    for team in (0, 1):
        assert (await ctx.join(tid, team)).status_code == 201
    assert (await ctx.client.post(f"/tournaments/{tid}/start", headers=ctx.admin)).status_code == 200
    person = await _me(ctx, ctx.outsider)
    resp = await ctx.client.post(f"/tournaments/{tid}/invitations", json={"user_id": person["id"]}, headers=ctx.admin)
    assert resp.status_code == 409
