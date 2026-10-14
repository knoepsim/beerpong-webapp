"""Registration deadline, optional check-in and the one-step start."""
from dataclasses import dataclass, field
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

FUTURE = "2099-12-31T20:00:00Z"
LONG_AGO = "2020-01-01T10:00:00Z"
PAST = "2026-01-01T10:00:00Z"


@dataclass
class Ctx:
    client: AsyncClient
    admin: dict
    players: list[dict]  # two players per team
    team_ids: list[str] = field(default_factory=list)

    async def create(self, **overrides) -> str:
        body = {"name": "Cup", "start_time": FUTURE, "visibility": "public_listed", **overrides}
        resp = await self.client.post("/tournaments", json=body, headers=self.admin)
        assert resp.status_code == 201, resp.text
        return resp.json()["id"]

    async def get(self, tid: str) -> dict:
        return (await self.client.get(f"/tournaments/{tid}", headers=self.admin)).json()

    async def join(self, tid: str, team: int):
        return await self.client.post(
            f"/tournaments/{tid}/join", json={"team_id": self.team_ids[team]}, headers=self.players[team * 2]
        )

    async def checkin(self, tid: str, team: int, value: bool = True):
        return await self.client.post(
            f"/tournaments/{tid}/teams/{self.team_ids[team]}/checkin",
            json={"is_checked_in": value},
            headers=self.admin,
        )

    async def start(self, tid: str):
        return await self.client.post(f"/tournaments/{tid}/start", headers=self.admin)

    async def teams(self, tid: str) -> list[str]:
        resp = await self.client.get(f"/tournaments/{tid}/teams", headers=self.admin)
        return [t["id"] for t in resp.json()]

    async def matches(self, tid: str) -> list[dict]:
        return (await self.client.get(f"/tournaments/{tid}/bracket", headers=self.admin)).json()["matches"]


async def _login(client: AsyncClient, n: int) -> dict:
    phone = f"+4915700000{n:02d}"
    await client.post("/auth/request-code", json={"phone_number": phone})
    token = (await client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def ctx(async_client: AsyncClient) -> Ctx:
    """An organizer and three complete teams."""
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        admin = await _login(async_client, 0)
        players = [await _login(async_client, i) for i in range(1, 7)]

    c = Ctx(async_client, admin, players)
    for i in range(3):
        creator, joiner = players[i * 2], players[i * 2 + 1]
        team = (await async_client.post("/teams", json={"name": f"T{i}"}, headers=creator)).json()["id"]
        token = (await async_client.post(f"/teams/{team}/invite", headers=creator)).json()["token"]
        await async_client.post(f"/teams/join/{token}", headers=joiner)
        c.team_ids.append(team)
    return c


# --- registration ----------------------------------------------------------------


@pytest.mark.asyncio
async def test_registration_is_open_until_the_deadline(ctx: Ctx):
    open_tid = await ctx.create(registration_end_time=FUTURE)
    closed_tid = await ctx.create(registration_end_time=PAST, start_time=FUTURE)

    assert (await ctx.join(open_tid, 0)).status_code == 201
    resp = await ctx.join(closed_tid, 0)
    assert resp.status_code == 409
    assert resp.json()["error_code"] == "REGISTRATION_CLOSED"


@pytest.mark.asyncio
async def test_without_deadline_registration_stays_open_until_start(ctx: Ctx):
    tid = await ctx.create()
    assert (await ctx.join(tid, 0)).status_code == 201
    assert (await ctx.join(tid, 1)).status_code == 201
    assert (await ctx.start(tid)).status_code == 200
    assert (await ctx.join(tid, 2)).status_code == 409


# --- phase / flags ---------------------------------------------------------------


@pytest.mark.asyncio
async def test_phase_follows_the_schedule(ctx: Ctx):
    registration = await ctx.get(await ctx.create(registration_end_time=FUTURE))
    assert (registration["phase"], registration["registration_open"], registration["checkin_open"]) == (
        "registration", True, False,
    )

    closed = await ctx.get(await ctx.create(registration_end_time=PAST))
    assert (closed["phase"], closed["registration_open"]) == ("registration_closed", False)

    checkin = await ctx.get(
        await ctx.create(registration_end_time=LONG_AGO, checkin_enabled=True, checkin_start_time=PAST)
    )
    assert (checkin["phase"], checkin["checkin_open"]) == ("checkin", True)

    not_yet = await ctx.get(
        await ctx.create(registration_end_time=PAST, checkin_enabled=True, checkin_start_time=FUTURE)
    )
    assert (not_yet["phase"], not_yet["checkin_open"]) == ("registration_closed", False)

    # without an own check-in time the check-in opens with the end of the registration
    waiting = await ctx.get(await ctx.create(checkin_enabled=True, registration_end_time=FUTURE))
    assert (waiting["phase"], waiting["checkin_open"]) == ("registration", False)
    after_deadline = await ctx.get(await ctx.create(checkin_enabled=True, registration_end_time=PAST))
    assert (after_deadline["phase"], after_deadline["checkin_open"]) == ("checkin", True)

    tid = await ctx.create(checkin_enabled=True)
    await ctx.join(tid, 0)
    await ctx.join(tid, 1)
    await ctx.checkin(tid, 0)
    await ctx.checkin(tid, 1)
    await ctx.start(tid)
    started = await ctx.get(tid)
    assert (started["phase"], started["registration_open"], started["checkin_open"]) == ("running", False, False)
    assert started["finished_at"] is None


# --- check-in --------------------------------------------------------------------


@pytest.mark.asyncio
async def test_checkin_only_works_when_enabled_and_open(ctx: Ctx):
    disabled = await ctx.create()
    await ctx.join(disabled, 0)
    resp = await ctx.checkin(disabled, 0)
    assert (resp.status_code, resp.json()["error_code"]) == (409, "CHECKIN_DISABLED")

    later = await ctx.create(checkin_enabled=True, checkin_start_time=FUTURE)
    await ctx.join(later, 0)
    resp = await ctx.checkin(later, 0)
    assert (resp.status_code, resp.json()["error_code"]) == (409, "CHECKIN_NOT_OPEN")

    open_tid = await ctx.create(checkin_enabled=True, checkin_start_time=PAST)
    await ctx.join(open_tid, 0)
    assert (await ctx.checkin(open_tid, 0)).status_code == 204
    assert (await ctx.checkin(open_tid, 0, False)).status_code == 204


@pytest.mark.asyncio
async def test_players_cannot_check_in_teams(ctx: Ctx):
    tid = await ctx.create(checkin_enabled=True)
    await ctx.join(tid, 0)
    resp = await ctx.client.post(
        f"/tournaments/{tid}/teams/{ctx.team_ids[0]}/checkin", json={"is_checked_in": True}, headers=ctx.players[0]
    )
    assert resp.status_code == 403


# --- start -----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_start_with_checkin_removes_teams_that_did_not_show_up(ctx: Ctx):
    tid = await ctx.create(checkin_enabled=True)
    for team in range(3):
        await ctx.join(tid, team)
    await ctx.checkin(tid, 0)
    await ctx.checkin(tid, 2)

    resp = await ctx.start(tid)

    assert resp.status_code == 200
    assert resp.json() == {"team_count": 2, "removed_team_ids": [ctx.team_ids[1]]}
    assert sorted(await ctx.teams(tid)) == sorted([ctx.team_ids[0], ctx.team_ids[2]])
    matches = await ctx.matches(tid)
    assert len(matches) == 1
    assert {matches[0]["team_a_id"], matches[0]["team_b_id"]} == {ctx.team_ids[0], ctx.team_ids[2]}


@pytest.mark.asyncio
async def test_start_without_checkin_lets_everybody_play(ctx: Ctx):
    tid = await ctx.create()
    for team in range(3):
        await ctx.join(tid, team)

    resp = await ctx.start(tid)

    assert resp.json() == {"team_count": 3, "removed_team_ids": []}
    assert len(await ctx.matches(tid)) == 2  # 3 teams: one match + final


@pytest.mark.asyncio
async def test_start_needs_two_registered_teams(ctx: Ctx):
    tid = await ctx.create()
    await ctx.join(tid, 0)

    resp = await ctx.start(tid)

    assert (resp.status_code, resp.json()["error_code"]) == (409, "NOT_ENOUGH_TEAMS")


@pytest.mark.asyncio
async def test_start_needs_two_checked_in_teams_and_removes_nobody_otherwise(ctx: Ctx):
    tid = await ctx.create(checkin_enabled=True)
    await ctx.join(tid, 0)
    await ctx.join(tid, 1)
    await ctx.checkin(tid, 0)

    resp = await ctx.start(tid)

    assert (resp.status_code, resp.json()["error_code"]) == (409, "NOT_ENOUGH_TEAMS")
    assert len(await ctx.teams(tid)) == 2, "nobody is removed when the start fails"
    assert (await ctx.get(tid))["phase"] != "running"


@pytest.mark.asyncio
async def test_generate_bracket_endpoint_is_gone(ctx: Ctx):
    tid = await ctx.create()
    resp = await ctx.client.post(f"/tournaments/{tid}/generate-bracket", headers=ctx.admin)
    assert resp.status_code in (404, 405)


# --- schedule validation ---------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "body",
    [
        {"registration_end_time": "2099-12-31T21:00:00Z"},  # registration closes after the start
        {"checkin_enabled": True, "checkin_start_time": "2099-12-31T21:00:00Z"},  # check-in after the start
        {
            "registration_end_time": "2099-12-31T19:00:00Z",
            "checkin_enabled": True,
            "checkin_start_time": "2099-12-31T18:00:00Z",
        },  # check-in before registration closes
        {"table_count": 0},
        {"name": ""},
    ],
)
async def test_invalid_schedule_or_values_are_rejected(ctx: Ctx, body: dict):
    resp = await ctx.client.post(
        "/tournaments", json={"name": "Cup", "start_time": FUTURE, **body}, headers=ctx.admin
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_validates_the_merged_schedule(ctx: Ctx):
    tid = await ctx.create(registration_end_time="2099-12-31T18:00:00Z")
    resp = await ctx.client.patch(
        f"/tournaments/{tid}", json={"start_time": "2099-12-31T17:00:00Z"}, headers=ctx.admin
    )
    assert (resp.status_code, resp.json()["error_code"]) == (422, "INVALID_SCHEDULE")


@pytest.mark.asyncio
async def test_disabling_checkin_clears_its_time(ctx: Ctx):
    tid = await ctx.create(checkin_enabled=True, checkin_start_time="2099-12-31T19:00:00Z")
    resp = await ctx.client.patch(f"/tournaments/{tid}", json={"checkin_enabled": False}, headers=ctx.admin)
    assert resp.status_code == 200
    assert resp.json()["checkin_start_time"] is None


@pytest.mark.asyncio
async def test_checkin_setting_cannot_change_after_start(ctx: Ctx):
    tid = await ctx.create()
    await ctx.join(tid, 0)
    await ctx.join(tid, 1)
    await ctx.start(tid)
    resp = await ctx.client.patch(f"/tournaments/{tid}", json={"checkin_enabled": True}, headers=ctx.admin)
    assert resp.status_code == 409
    # other details can still be edited
    resp = await ctx.client.patch(f"/tournaments/{tid}", json={"location": "Garten"}, headers=ctx.admin)
    assert resp.status_code == 200
