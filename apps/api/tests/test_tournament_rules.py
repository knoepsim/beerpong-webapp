"""Rules around the tournament state machine: bracket generation, roster changes and results."""
from dataclasses import dataclass, field

import pytest
import pytest_asyncio
from httpx import AsyncClient


@dataclass
class Setup:
    client: AsyncClient
    headers: list[dict]
    tournament_id: str
    team_ids: list[str] = field(default_factory=list)

    async def bracket(self) -> list[dict]:
        resp = await self.client.get(f"/tournaments/{self.tournament_id}/bracket", headers=self.headers[0])
        assert resp.status_code == 200
        return resp.json()["matches"]

    async def final(self) -> dict:
        matches = await self.bracket()
        return max(matches, key=lambda m: m["round"])

    async def post(self, path: str, **kwargs):
        return await self.client.post(f"/tournaments/{self.tournament_id}/{path}", headers=self.headers[0], **kwargs)

    async def start(self) -> None:
        assert (await self.post("generate-bracket")).status_code == 200
        assert (await self.post("start")).status_code == 204

    async def report(self, match_id: str, winner: str, method: str = "post"):
        return await self.client.request(
            method,
            f"/matches/{match_id}/results",
            json={"winner_team_id": winner, "cups_left": 2},
            headers=self.headers[0],
        )


async def _login(client: AsyncClient, phone: str) -> dict:
    await client.post("/auth/request-code", json={"phone_number": phone})
    resp = await client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest_asyncio.fixture
async def setup(async_client: AsyncClient) -> Setup:
    """Four complete teams (8 users) in a public tournament; user 0 is admin."""
    from unittest.mock import patch

    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        headers = [await _login(async_client, f"+4915100000{i:02d}") for i in range(8)]

    resp = await async_client.post(
        "/tournaments",
        json={"name": "Cup", "start_time": "2026-12-31T20:00:00Z", "visibility": "public_listed"},
        headers=headers[0],
    )
    s = Setup(async_client, headers, resp.json()["id"])

    for i in range(4):
        creator, joiner = headers[i * 2], headers[i * 2 + 1]
        team_id = (await async_client.post("/teams", json={"name": f"T{i}"}, headers=creator)).json()["id"]
        token = (await async_client.post(f"/teams/{team_id}/invite", headers=creator)).json()["token"]
        await async_client.post(f"/teams/join/{token}", headers=joiner)
        s.team_ids.append(team_id)
    return s


async def _join(s: Setup, idx: int):
    return await s.client.post(
        f"/tournaments/{s.tournament_id}/join", json={"team_id": s.team_ids[idx]}, headers=s.headers[idx * 2]
    )


async def _join_all(s: Setup):
    for i in range(4):
        assert (await _join(s, i)).status_code == 201


# --- Bracket generation / roster -------------------------------------------------


@pytest.mark.asyncio
async def test_regenerating_bracket_replaces_old_one(setup: Setup):
    await _join_all(setup)
    await setup.post("generate-bracket")
    await setup.post("generate-bracket")
    assert len(await setup.bracket()) == 3  # 4 teams -> 2 + 1 matches, no duplicates


@pytest.mark.asyncio
async def test_bracket_cannot_be_regenerated_after_start(setup: Setup):
    await _join_all(setup)
    await setup.start()
    resp = await setup.post("generate-bracket")
    assert resp.status_code == 409
    assert resp.json()["error_code"] == "TOURNAMENT_ALREADY_STARTED"


@pytest.mark.asyncio
async def test_start_twice_is_rejected(setup: Setup):
    await _join_all(setup)
    await setup.start()
    assert (await setup.post("start")).status_code == 409


@pytest.mark.asyncio
async def test_roster_is_frozen_after_start(setup: Setup):
    await _join(setup, 0)
    await _join(setup, 1)
    await setup.start()

    assert (await _join(setup, 2)).status_code == 409
    leave = await setup.client.delete(f"/tournaments/{setup.tournament_id}/leave", headers=setup.headers[0])
    assert leave.status_code == 409
    remove = await setup.client.delete(
        f"/tournaments/{setup.tournament_id}/teams/{setup.team_ids[1]}", headers=setup.headers[0]
    )
    assert remove.status_code == 409


# --- Results ---------------------------------------------------------------------


@pytest.mark.asyncio
async def test_result_requires_started_tournament(setup: Setup):
    await _join_all(setup)
    await setup.post("generate-bracket")
    match = (await setup.bracket())[0]
    resp = await setup.report(match["id"], match["team_a_id"])
    assert resp.status_code == 409
    assert resp.json()["error_code"] == "TOURNAMENT_NOT_STARTED"


@pytest.mark.asyncio
async def test_winner_must_play_in_match(setup: Setup):
    await _join_all(setup)
    await setup.start()
    first = next(m for m in await setup.bracket() if m["round"] == 1)
    outsider = next(t for t in setup.team_ids if t not in (first["team_a_id"], first["team_b_id"]))
    resp = await setup.report(first["id"], outsider)
    assert resp.status_code == 400
    assert resp.json()["error_code"] == "INVALID_WINNER"


@pytest.mark.asyncio
async def test_match_without_both_teams_is_not_ready(setup: Setup):
    await _join_all(setup)
    await setup.start()
    final = await setup.final()
    resp = await setup.report(final["id"], setup.team_ids[0])
    assert resp.status_code == 409
    assert resp.json()["error_code"] == "MATCH_NOT_READY"


@pytest.mark.asyncio
async def test_result_event_rules(setup: Setup):
    await _join_all(setup)
    await setup.start()
    first = next(m for m in await setup.bracket() if m["round"] == 1)
    a, b = first["team_a_id"], first["team_b_id"]

    # modify / delete need an existing result
    assert (await setup.report(first["id"], a, "patch")).status_code == 409
    assert (await setup.client.delete(f"/matches/{first['id']}/results", headers=setup.headers[0])).status_code == 409

    assert (await setup.report(first["id"], a)).status_code == 201
    # a second CREATED is a conflict
    assert (await setup.report(first["id"], b)).status_code == 409
    # modifying switches the winner in the next match
    assert (await setup.report(first["id"], b, "patch")).status_code == 200
    final = await setup.final()
    assert b in (final["team_a_id"], final["team_b_id"])
    assert a not in (final["team_a_id"], final["team_b_id"])

    # delete removes the winner again and a second delete is rejected
    assert (await setup.client.delete(f"/matches/{first['id']}/results", headers=setup.headers[0])).status_code == 200
    final = await setup.final()
    assert b not in (final["team_a_id"], final["team_b_id"])
    assert (await setup.client.delete(f"/matches/{first['id']}/results", headers=setup.headers[0])).status_code == 409

    # after deletion a new result can be created again
    assert (await setup.report(first["id"], a)).status_code == 201


@pytest.mark.asyncio
async def test_result_locked_once_next_match_is_decided(setup: Setup):
    await _join_all(setup)
    await setup.start()
    for m in [m for m in await setup.bracket() if m["round"] == 1]:
        assert (await setup.report(m["id"], m["team_a_id"])).status_code == 201
    final = await setup.final()
    assert (await setup.report(final["id"], final["team_a_id"])).status_code == 201

    first = next(m for m in await setup.bracket() if m["round"] == 1)
    resp = await setup.report(first["id"], first["team_b_id"], "patch")
    assert resp.status_code == 409
    assert resp.json()["error_code"] == "RESULT_CONFLICT"
