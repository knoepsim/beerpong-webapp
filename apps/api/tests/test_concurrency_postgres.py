"""Concurrency tests that need real row locks, so they run against PostgreSQL.

Skipped unless TEST_POSTGRES_URL points to an empty scratch database, e.g.
    TEST_POSTGRES_URL=postgresql+asyncpg://beerpong:beerpong_dev@localhost:5432/beerpong_test uv run pytest
All stations of that database are dropped and recreated.
"""
import asyncio
import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.services.bracket_service import BracketService
from app.services.team_service import TeamService
from main import app
from tests.helpers import PLAYS, won

POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL")
pytestmark = pytest.mark.skipif(not POSTGRES_URL, reason="TEST_POSTGRES_URL not set")


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine(POSTGRES_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def get_pg_db():
        async with maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    previous = app.dependency_overrides[get_db]
    app.dependency_overrides[get_db] = get_pg_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides[get_db] = previous
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def login(client: AsyncClient, n: int) -> dict:
    phone = f"+4915600000{n:02d}"
    await client.post("/auth/request-code", json={"phone_number": phone})
    token = (await client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def make_team(client: AsyncClient, name: str, creator: dict, joiner: dict | None = None) -> str:
    team_id = (await client.post("/teams", json={"name": name}, headers=creator)).json()["id"]
    if joiner:
        token = (await client.post(f"/teams/{team_id}/invite", headers=creator)).json()["token"]
        assert (await client.post(f"/teams/join/{token}", headers=joiner)).status_code == 200
    return team_id


def rendezvous(monkeypatch, cls, method: str, timeout: float = 0.5) -> None:
    """Make two concurrent requests meet right after a check, before either of them writes.

    Without proper locking both pass the check and the race is guaranteed. With a row lock the
    second request is held back before reaching this point, so the first one just waits for the
    timeout and carries on alone.
    """
    original = getattr(cls, method)
    barrier = asyncio.Barrier(2)

    async def wrapped(self, *args, **kwargs):
        result = await original(self, *args, **kwargs)
        try:
            await asyncio.wait_for(barrier.wait(), timeout)
        except (asyncio.TimeoutError, asyncio.BrokenBarrierError):
            pass
        return result

    monkeypatch.setattr(cls, method, wrapped)


async def statuses(*requests) -> list[int]:
    return sorted(r.status_code for r in await asyncio.gather(*requests))


@pytest.mark.asyncio
async def test_team_cannot_be_overfilled_by_concurrent_invite_accepts(client: AsyncClient, monkeypatch):
    owner, a, b = [await login(client, i) for i in range(3)]
    team_id = await make_team(client, "Duo", owner)
    token = (await client.post(f"/teams/{team_id}/invite", headers=owner)).json()["token"]
    rendezvous(monkeypatch, TeamService, "get_team_member_count")

    result = await statuses(
        client.post(f"/teams/join/{token}", headers=a),
        client.post(f"/teams/join/{token}", headers=b),
    )

    print('RESULT-team', result)
    assert result[0] == 200 and 400 <= result[1] < 500
    team = (await client.get(f"/teams/{team_id}", headers=owner)).json()
    assert len(team["members"]) == 2


@pytest.mark.asyncio
async def test_player_cannot_enter_a_tournament_with_two_teams_concurrently(client: AsyncClient, monkeypatch):
    admin, p1, p2, p3 = [await login(client, i) for i in range(4)]
    tid = (
        await client.post(
            "/tournaments",
            json={**PLAYS, "name": "Cup", "start_time": "2026-12-31T20:00:00Z", "visibility": "public"},
            headers=admin,
        )
    ).json()["id"]
    team_a = await make_team(client, "A", p1, p2)
    team_b = await make_team(client, "B", p1, p3)
    rendezvous(monkeypatch, TeamService, "get_team_members")

    result = await statuses(
        client.post(f"/tournaments/{tid}/join", json={"team_id": team_a}, headers=p1),
        client.post(f"/tournaments/{tid}/join", json={"team_id": team_b}, headers=p1),
    )

    assert result[0] == 201 and 400 <= result[1] < 500
    assert len((await client.get(f"/tournaments/{tid}/teams", headers=admin)).json()) == 1


@pytest.mark.asyncio
async def test_match_result_cannot_be_reported_twice_concurrently(client: AsyncClient, monkeypatch):
    admin, *players = [await login(client, i) for i in range(5)]
    tid = (
        await client.post(
            "/tournaments",
            json={**PLAYS, "name": "Cup", "start_time": "2026-12-31T20:00:00Z", "visibility": "public"},
            headers=admin,
        )
    ).json()["id"]
    for i in range(2):
        team_id = await make_team(client, f"T{i}", players[i * 2], players[i * 2 + 1] if i * 2 + 1 < 4 else None)
        await client.post(f"/tournaments/{tid}/join", json={"team_id": team_id}, headers=players[i * 2])
    assert (await client.post(f"/tournaments/{tid}/start", headers=admin)).status_code == 200
    match = (await client.get(f"/tournaments/{tid}/bracket", headers=admin)).json()["matches"][0]
    body = won(match, match["team_a_id"], 1)
    rendezvous(monkeypatch, BracketService, "_has_active_result")

    result = await statuses(
        client.post(f"/matches/{match['id']}/results", json=body, headers=admin),
        client.post(f"/matches/{match['id']}/results", json=body, headers=admin),
    )

    assert result[0] == 201 and result[1] == 409
    log = (await client.get(f"/matches/{match['id']}/results", headers=admin)).json()
    assert [r["type"] for r in log] == ["created"]


@pytest.mark.asyncio
async def test_two_results_at_the_same_time_do_not_give_one_station_to_two_matches(client: AsyncClient, monkeypatch):
    admin, *players = [await login(client, i) for i in range(17)]
    tid = (
        await client.post(
            "/tournaments",
            json={**PLAYS, "name": "Cup", "start_time": "2026-12-31T20:00:00Z", "visibility": "public", "station_count": 2},
            headers=admin,
        )
    ).json()["id"]
    for i in range(8):
        team_id = await make_team(client, f"T{i}", players[2 * i], players[2 * i + 1])
        await client.post(f"/tournaments/{tid}/join", json={"team_id": team_id}, headers=players[2 * i])
    assert (await client.post(f"/tournaments/{tid}/start", headers=admin)).status_code == 200
    matches = (await client.get(f"/tournaments/{tid}/bracket", headers=admin)).json()["matches"]
    playing = [x for x in matches if x["round"] == 1 and x["station_name"]]
    rendezvous(monkeypatch, BracketService, "_plan_input")

    result = await statuses(
        *(
            client.post(f"/matches/{x['id']}/results", json=won(x, x["team_a_id"], 1), headers=admin)
            for x in playing
        )
    )

    assert result == [201, 201]
    matches = (await client.get(f"/tournaments/{tid}/bracket", headers=admin)).json()["matches"]
    at_stations = [x["station_name"] for x in matches if x["status"] == "ready" and x["station_name"]]
    assert sorted(at_stations) == ["Tisch 1", "Tisch 2"]
