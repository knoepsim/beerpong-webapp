"""Live view: every change raises the revision of its tournament and says what changed; the stream carries that."""
import asyncio
from unittest.mock import patch
from uuid import UUID

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import event

from app.core.config import settings
from app.core.events import bus
from conftest import TestingSessionLocal, engine

FUTURE = "2099-12-31T20:00:00Z"
PAST = "2026-01-01T10:00:00Z"


async def _login(client: AsyncClient, n: int) -> dict:
    phone = f"+4915500000{n:02d}"
    await client.post("/auth/request-code", json={"phone_number": phone})
    token = (await client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class Ctx:
    def __init__(self, client, admin, players, outsider, team_ids):
        self.client, self.admin, self.players, self.outsider, self.team_ids = client, admin, players, outsider, team_ids

    async def create(self, **body) -> dict:
        resp = await self.client.post(
            "/tournaments", json={"name": "Cup", "start_time": FUTURE, **body}, headers=self.admin
        )
        assert resp.status_code == 201, resp.text
        return resp.json()

    async def join(self, tid: str, team: int):
        return await self.client.post(
            f"/tournaments/{tid}/join", json={"team_id": self.team_ids[team]}, headers=self.players[team * 2]
        )

    async def revision(self, tid: str) -> int:
        return (await self.client.get(f"/tournaments/{tid}/state", headers=self.admin)).json()["revision"]


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
    return Ctx(async_client, admin, players, outsider, team_ids)


@pytest.fixture
def watch():
    """Listen to the signals of a tournament the way a browser does."""
    subscriptions = []

    class Watcher:
        def __init__(self, tid: str):
            self.tid = UUID(tid)
            self.subscription = bus.subscribe(self.tid, max_total=100)
            subscriptions.append((self.tid, self.subscription))

        async def signal(self) -> dict | None:
            event_ = await self.subscription.next(0.05)
            assert event_ is None or event_.name == "revision"
            return event_.data if event_ else None

    yield Watcher
    for tid, subscription in subscriptions:
        bus.unsubscribe(tid, subscription)


# --- revision and signals ----------------------------------------------------------


@pytest.mark.asyncio
async def test_a_new_tournament_starts_at_revision_zero_and_the_state_says_it(ctx: Ctx):
    tournament = await ctx.create()
    assert tournament["revision"] == 0
    assert (await ctx.client.get(f"/tournaments/{tournament['id']}/state")).json() == {"revision": 0}


@pytest.mark.asyncio
async def test_joining_leaving_removing_and_checking_in_change_the_teams(ctx: Ctx, watch):
    tid = (await ctx.create(checkin_enabled=True, checkin_start_time=PAST, checkin_auto_open=True))["id"]
    watcher = watch(tid)

    assert (await ctx.join(tid, 0)).status_code == 201
    assert await watcher.signal() == {"revision": 1, "changed": ["teams"]}

    resp = await ctx.client.post(
        f"/tournaments/{tid}/teams/{ctx.team_ids[0]}/checkin", json={"is_checked_in": True}, headers=ctx.admin
    )
    assert resp.status_code == 204
    assert await watcher.signal() == {"revision": 2, "changed": ["teams"]}

    assert (await ctx.client.delete(f"/tournaments/{tid}/leave", headers=ctx.players[0])).status_code == 204
    assert await watcher.signal() == {"revision": 3, "changed": ["teams"]}

    await ctx.join(tid, 1)
    await watcher.signal()
    resp = await ctx.client.delete(f"/tournaments/{tid}/teams/{ctx.team_ids[1]}", headers=ctx.admin)
    assert resp.status_code == 204
    assert await watcher.signal() == {"revision": 5, "changed": ["teams"]}


@pytest.mark.asyncio
async def test_settings_and_the_switches_change_the_tournament(ctx: Ctx, watch):
    tid = (await ctx.create(checkin_enabled=True))["id"]
    watcher = watch(tid)

    await ctx.client.patch(f"/tournaments/{tid}", json={"name": "Neu"}, headers=ctx.admin)
    assert await watcher.signal() == {"revision": 1, "changed": ["tournament"]}
    await ctx.client.put(f"/tournaments/{tid}/registration", json={"open": False}, headers=ctx.admin)
    assert await watcher.signal() == {"revision": 2, "changed": ["tournament"]}
    await ctx.client.put(f"/tournaments/{tid}/checkin", json={"open": True}, headers=ctx.admin)
    assert await watcher.signal() == {"revision": 3, "changed": ["tournament"]}
    assert (await ctx.revision(tid)) == 3


@pytest.mark.asyncio
async def test_roles_change_the_roles(ctx: Ctx, watch):
    tid = (await ctx.create())["id"]
    watcher = watch(tid)
    me = (await ctx.client.get("/users/me", headers=ctx.outsider)).json()["id"]

    resp = await ctx.client.post(f"/tournaments/{tid}/roles", json={"user_id": me, "role": "referee"}, headers=ctx.admin)
    assert resp.status_code == 201
    assert await watcher.signal() == {"revision": 1, "changed": ["roles"]}

    role_id = resp.json()["id"]
    assert (await ctx.client.delete(f"/tournaments/{tid}/roles/{role_id}", headers=ctx.admin)).status_code == 204
    assert await watcher.signal() == {"revision": 2, "changed": ["roles"]}


@pytest.mark.asyncio
async def test_start_and_results_change_what_the_viewers_see(ctx: Ctx, watch):
    tid = (await ctx.create())["id"]
    await ctx.join(tid, 0)
    await ctx.join(tid, 1)
    watcher = watch(tid)

    assert (await ctx.client.post(f"/tournaments/{tid}/start", headers=ctx.admin)).status_code == 200
    started = await watcher.signal()
    assert started["changed"] == ["bracket", "teams", "tournament"]

    match = (await ctx.client.get(f"/tournaments/{tid}/bracket", headers=ctx.admin)).json()["matches"][0]
    resp = await ctx.client.post(
        f"/matches/{match['id']}/results",
        json={"winner_team_id": match["team_a_id"], "cups_left": 4},
        headers=ctx.admin,
    )
    assert resp.status_code == 201
    result = await watcher.signal()
    assert result["changed"] == ["bracket", "tournament"]
    assert result["revision"] > started["revision"]


@pytest.mark.asyncio
async def test_a_team_that_is_renamed_or_gets_a_player_changes_every_tournament_it_plays_in(ctx: Ctx, watch):
    tid = (await ctx.create())["id"]
    await ctx.join(tid, 0)
    watcher = watch(tid)

    await ctx.client.patch(f"/teams/{ctx.team_ids[0]}", json={"name": "Neu"}, headers=ctx.players[0])
    assert (await watcher.signal())["changed"] == ["bracket", "teams"]

    other = await ctx.create(name="Other")  # a tournament the team does not play in stays quiet
    quiet = watch(other["id"])
    await ctx.client.patch(f"/teams/{ctx.team_ids[0]}", json={"name": "Noch neuer"}, headers=ctx.players[0])
    assert await quiet.signal() is None


@pytest.mark.asyncio
async def test_what_fails_sends_no_signal_and_does_not_count(ctx: Ctx, watch):
    tid = (await ctx.create())["id"]
    await ctx.join(tid, 0)
    watcher = watch(tid)
    await watcher.signal()
    before = await ctx.revision(tid)

    resp = await ctx.join(tid, 0)  # the same team again

    assert resp.status_code >= 400
    assert await watcher.signal() is None
    assert await ctx.revision(tid) == before


@pytest.mark.asyncio
async def test_signals_of_one_burst_arrive_as_one_event_with_everything_that_changed(ctx: Ctx, watch):
    tid = (await ctx.create())["id"]
    watcher = watch(tid)

    await ctx.join(tid, 0)
    await ctx.client.patch(f"/tournaments/{tid}", json={"name": "Neu"}, headers=ctx.admin)

    assert await watcher.signal() == {"revision": 2, "changed": ["teams", "tournament"]}
    assert await watcher.signal() is None


@pytest.mark.asyncio
async def test_the_state_follows_the_visibility_of_the_tournament(ctx: Ctx):
    private = (await ctx.create(visibility="private", join_policy="invite_only"))["id"]
    assert (await ctx.client.get(f"/tournaments/{private}/state")).status_code == 403
    assert (await ctx.client.get(f"/tournaments/{private}/state", headers=ctx.admin)).status_code == 200


# --- the stream ------------------------------------------------------------------------


@pytest.fixture
def short_streams(monkeypatch):
    """Streams that end after a moment, so a test can read the whole body; and the test database for the access check."""
    monkeypatch.setattr(settings, "sse_heartbeat_seconds", 0.05)
    monkeypatch.setattr(settings, "sse_max_seconds", 0.3)
    monkeypatch.setattr("app.routers.events.async_session", TestingSessionLocal)


@pytest.mark.asyncio
async def test_the_stream_starts_with_the_current_revision_then_beats_and_ends(ctx: Ctx, short_streams):
    tid = (await ctx.create())["id"]
    await ctx.client.patch(f"/tournaments/{tid}", json={"name": "Neu"}, headers=ctx.admin)

    resp = await ctx.client.get(f"/tournaments/{tid}/events")  # no login: it is a public tournament

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    assert "no-transform" in resp.headers["cache-control"]
    body = resp.text
    assert body.startswith("retry: 3000\n\n")
    assert 'event: revision\nid: 1\ndata: {"revision":1,"changed":["all"]}\n\n' in body
    assert ": ping\n\n" in body
    assert bus.count == 0, "the connection is given back when the stream ends"


@pytest.mark.asyncio
async def test_a_change_during_the_stream_is_sent(ctx: Ctx, short_streams):
    tid = (await ctx.create())["id"]

    stream = asyncio.create_task(ctx.client.get(f"/tournaments/{tid}/events"))
    await asyncio.sleep(0.1)
    await ctx.join(tid, 0)
    body = (await stream).text

    assert 'event: revision\nid: 1\ndata: {"revision":1,"changed":["teams"]}' in body


@pytest.mark.asyncio
async def test_a_private_tournament_does_not_stream_to_strangers(ctx: Ctx, short_streams):
    tid = (await ctx.create(visibility="private", join_policy="invite_only"))["id"]

    assert (await ctx.client.get(f"/tournaments/{tid}/events")).status_code == 403
    assert (await ctx.client.get(f"/tournaments/{tid}/events", headers=ctx.outsider)).status_code == 403
    assert (await ctx.client.get(f"/tournaments/{tid}/events", headers=ctx.admin)).status_code == 200
    assert bus.count == 0, "a refused connection holds nothing"


@pytest.mark.asyncio
async def test_an_unknown_tournament_has_no_stream(ctx: Ctx, short_streams):
    resp = await ctx.client.get("/tournaments/00000000-0000-0000-0000-000000000000/events")
    assert resp.status_code == 404
    assert bus.count == 0


@pytest.mark.asyncio
async def test_too_many_streams_are_turned_away_politely(ctx: Ctx, short_streams, monkeypatch):
    tid = (await ctx.create())["id"]
    monkeypatch.setattr(settings, "sse_max_connections", 0)

    resp = await ctx.client.get(f"/tournaments/{tid}/events")

    assert resp.status_code == 503
    assert resp.headers["retry-after"] == "30"


# --- the team list asks the database once for all members ------------------------------


@pytest.mark.asyncio
async def test_the_teams_of_a_tournament_load_their_players_in_one_query(ctx: Ctx):
    tid = (await ctx.create())["id"]
    await ctx.join(tid, 0)
    await ctx.join(tid, 1)
    statements: list[str] = []

    def count(conn, cursor, statement, *args):
        statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", count)
    try:
        resp = await ctx.client.get(f"/tournaments/{tid}/teams", headers=ctx.players[0])
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", count)

    assert resp.status_code == 200 and len(resp.json()) == 2
    member_queries = [s for s in statements if "FROM team_members" in s and "JOIN users" in s]
    assert len(member_queries) == 1
