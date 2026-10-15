"""Registration deadline, optional check-in and the one-step start."""
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.tournament import Tournament

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
        body = {"name": "Cup", "start_time": FUTURE, "visibility": "public", **overrides}
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

    async def create_with_open_checkin(self, **overrides) -> str:
        return await self.create(checkin_enabled=True, checkin_start_time=PAST, checkin_auto_open=True, **overrides)

    async def set_registration(self, tid: str, open_: bool):
        return await self.client.put(f"/tournaments/{tid}/registration", json={"open": open_}, headers=self.admin)

    async def set_checkin(self, tid: str, open_: bool):
        return await self.client.put(f"/tournaments/{tid}/checkin", json={"open": open_}, headers=self.admin)

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
    open_tid = await ctx.create(registration_end_time=FUTURE, registration_auto_close=True)
    closed_tid = await ctx.create(registration_end_time=PAST, registration_auto_close=True, start_time=FUTURE)

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
async def test_phase_follows_the_switches_and_the_schedule(ctx: Ctx):
    registration = await ctx.get(await ctx.create(registration_end_time=FUTURE, registration_auto_close=True))
    assert (registration["phase"], registration["registration_open"], registration["checkin_open"]) == (
        "registration", True, False,
    )

    closed = await ctx.get(await ctx.create(registration_end_time=PAST, registration_auto_close=True))
    assert (closed["phase"], closed["registration_open"]) == ("registration_closed", False)

    # without the automation the deadline is only a note for the players
    only_a_note = await ctx.get(await ctx.create(registration_end_time=PAST))
    assert only_a_note["registration_open"] is True

    checkin = await ctx.get(
        await ctx.create(
            registration_end_time=LONG_AGO, registration_auto_close=True,
            checkin_enabled=True, checkin_start_time=PAST, checkin_auto_open=True,
        )
    )
    assert (checkin["phase"], checkin["registration_open"], checkin["checkin_open"]) == ("checkin", False, True)

    not_yet = await ctx.get(
        await ctx.create(checkin_enabled=True, checkin_start_time=FUTURE, checkin_auto_open=True)
    )
    assert (not_yet["phase"], not_yet["checkin_open"]) == ("registration", False)

    both = await ctx.get(await ctx.create_with_open_checkin())
    assert (both["phase"], both["registration_open"], both["checkin_open"]) == (
        "registration_and_checkin", True, True,
    )

    tid = await ctx.create_with_open_checkin()
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

    later = await ctx.create(checkin_enabled=True, checkin_start_time=FUTURE, checkin_auto_open=True)
    await ctx.join(later, 0)
    resp = await ctx.checkin(later, 0)
    assert (resp.status_code, resp.json()["error_code"]) == (409, "CHECKIN_NOT_OPEN")

    open_tid = await ctx.create_with_open_checkin()
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


@pytest.mark.asyncio
async def test_registration_and_check_in_are_switched_independently_at_any_time(ctx: Ctx):
    tid = await ctx.create(checkin_enabled=True)
    for _ in range(2):  # switching to the same state twice is harmless
        assert (await ctx.set_checkin(tid, True)).status_code == 204
    tournament = await ctx.get(tid)
    assert (tournament["phase"], tournament["registration_open"], tournament["checkin_open"]) == (
        "registration_and_checkin", True, True,
    )

    await ctx.set_registration(tid, False)
    assert (await ctx.get(tid))["phase"] == "checkin"

    await ctx.set_checkin(tid, False)
    assert (await ctx.get(tid))["phase"] == "registration_closed"

    await ctx.set_registration(tid, True)  # one more team is brought along
    assert (await ctx.join(tid, 0)).status_code == 201


@pytest.mark.asyncio
async def test_a_team_can_register_while_check_in_is_open(ctx: Ctx):
    tid = await ctx.create_with_open_checkin()
    assert (await ctx.join(tid, 0)).status_code == 201
    assert (await ctx.checkin(tid, 0)).status_code == 204


@pytest.mark.asyncio
async def test_the_schedule_runs_even_after_a_manual_switch_but_not_over_a_later_one(ctx: Ctx):
    # a switch after the time wins: the registration was closed by its deadline and is opened again by hand
    reg = await ctx.create(registration_end_time=PAST, registration_auto_close=True)
    assert (await ctx.get(reg))["registration_open"] is False
    await ctx.set_registration(reg, True)
    assert (await ctx.get(reg))["registration_open"] is True


def test_the_schedule_overrides_earlier_manual_switches_only():
    """Pure rule: at its time the schedule flips the switch, whatever was switched before; later switches win."""
    t = datetime(2026, 7, 1, 20, 0, tzinfo=UTC)
    before, after = t - timedelta(hours=1), t + timedelta(hours=1)
    switch = Tournament._switch

    # check-in: closed by hand at 19:00, the schedule opens it at 20:00
    assert switch(False, before, True, t, True, now=before + timedelta(minutes=30)) is False
    assert switch(False, before, True, t, True, now=t) is True
    # opened/closed by hand after the time: stays as the organizer left it
    assert switch(False, after, True, t, True, now=after + timedelta(hours=1)) is False
    # no automation: the time is only a note
    assert switch(False, None, False, t, True, now=after) is False
    # registration: reopened at 19:30, still closes at 20:00
    assert switch(True, before, True, t, False, now=after) is False


@pytest.mark.asyncio
async def test_changing_the_time_moves_the_automation(ctx: Ctx):
    tid = await ctx.create(registration_end_time=PAST, registration_auto_close=True)
    assert (await ctx.get(tid))["registration_open"] is False

    await ctx.client.patch(f"/tournaments/{tid}", json={"registration_end_time": FUTURE}, headers=ctx.admin)
    assert (await ctx.get(tid))["registration_open"] is True

    await ctx.client.patch(f"/tournaments/{tid}", json={"registration_auto_close": False}, headers=ctx.admin)
    await ctx.client.patch(f"/tournaments/{tid}", json={"registration_end_time": PAST}, headers=ctx.admin)
    assert (await ctx.get(tid))["registration_open"] is True, "without the automation the time is only a note"


@pytest.mark.asyncio
async def test_an_automation_needs_its_time(ctx: Ctx):
    tid = await ctx.create(registration_auto_close=True, checkin_enabled=True, checkin_auto_open=True)
    tournament = await ctx.get(tid)
    assert (tournament["registration_auto_close"], tournament["checkin_auto_open"]) == (False, False)


@pytest.mark.asyncio
async def test_switches_cannot_be_used_without_check_in_after_the_start_or_by_players(ctx: Ctx):
    plain = await ctx.create()
    resp = await ctx.set_checkin(plain, True)
    assert (resp.status_code, resp.json()["error_code"]) == (409, "CHECKIN_DISABLED")

    tid = await ctx.create_with_open_checkin()
    for url in ("registration", "checkin"):
        resp = await ctx.client.put(f"/tournaments/{tid}/{url}", json={"open": True}, headers=ctx.players[0])
        assert resp.status_code == 403

    for team in range(2):
        await ctx.join(tid, team)
        await ctx.checkin(tid, team)
    await ctx.start(tid)
    assert (await ctx.set_registration(tid, True)).status_code == 409
    assert (await ctx.set_checkin(tid, True)).status_code == 409


@pytest.mark.asyncio
async def test_switching_check_in_off_closes_it(ctx: Ctx):
    tid = await ctx.create_with_open_checkin()
    await ctx.client.patch(f"/tournaments/{tid}", json={"checkin_enabled": False}, headers=ctx.admin)
    tournament = await ctx.get(tid)
    assert (tournament["checkin_open"], tournament["checkin_start_time"], tournament["checkin_auto_open"]) == (
        False, None, False,
    )


# --- start -----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_start_with_checkin_removes_teams_that_did_not_show_up(ctx: Ctx):
    tid = await ctx.create_with_open_checkin()
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
    tid = await ctx.create_with_open_checkin()
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
