"""Matches get stations: after the draw, after every result and when stations change."""
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from tests.helpers import PLAYS, won

FUTURE = "2099-12-31T20:00:00Z"


async def _login(client: AsyncClient, n: int) -> dict:
    phone = f"+4915200000{n:02d}"
    await client.post("/auth/request-code", json={"phone_number": phone})
    token = (await client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class Ctx:
    def __init__(self, client: AsyncClient, admin: dict, tid: str):
        self.client, self.admin, self.tid = client, admin, tid

    async def bracket(self) -> list[dict]:
        resp = await self.client.get(f"/tournaments/{self.tid}/bracket", headers=self.admin)
        return sorted(resp.json()["matches"], key=lambda x: (x["round"], x["position"]))

    async def round(self, number: int) -> list[dict]:
        return [x for x in await self.bracket() if x["round"] == number]

    async def by_id(self, mid: str) -> dict:
        return next(x for x in await self.bracket() if x["id"] == mid)

    async def win(self, match: dict, side: str = "a"):
        resp = await self.client.post(
            f"/matches/{match['id']}/results",
            json=won(match, match[f"team_{side}_id"], 2),
            headers=self.admin,
        )
        assert resp.status_code == 201, resp.text

    async def stations(self) -> list[dict]:
        return (await self.client.get(f"/tournaments/{self.tid}/stations", headers=self.admin)).json()


async def _tournament(client: AsyncClient, teams: int, stations: int) -> Ctx:
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        admin = await _login(client, 0)
        players = [await _login(client, i) for i in range(1, 2 * teams + 1)]
    tid = (
        await client.post(
            "/tournaments", json={**PLAYS, "name": "Cup", "start_time": FUTURE, "station_count": stations}, headers=admin
        )
    ).json()["id"]
    for i in range(teams):
        creator, joiner = players[2 * i], players[2 * i + 1]
        team_id = (await client.post("/teams", json={"name": f"T{i}"}, headers=creator)).json()["id"]
        token = (await client.post(f"/teams/{team_id}/invite", headers=creator)).json()["token"]
        await client.post(f"/teams/join/{token}", headers=joiner)
        assert (await client.post(f"/tournaments/{tid}/join", json={"team_id": team_id}, headers=creator)).status_code == 201
    assert (await client.post(f"/tournaments/{tid}/start", headers=admin)).status_code == 200
    return Ctx(client, admin, tid)


@pytest_asyncio.fixture
async def eight_teams_two_stations(async_client: AsyncClient) -> Ctx:
    return await _tournament(async_client, 8, 2)


@pytest.mark.asyncio
async def test_after_the_draw_the_first_matches_are_at_the_stations_and_the_rest_queue(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations
    first = await ctx.round(1)

    assert [(x["station_name"], x["queue_position"]) for x in first] == [
        ("Tisch 1", None), ("Tisch 2", None), (None, 1), (None, 2),
    ]
    assert all(x["station_name"] is None and x["queue_position"] is None for x in await ctx.round(2))


@pytest.mark.asyncio
async def test_a_result_frees_the_station_for_the_next_match_in_the_queue(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations
    first = await ctx.round(1)

    await ctx.win(first[1])  # the match at Tisch 2 ends

    after = await ctx.round(1)
    assert after[1]["station_name"] == "Tisch 2"  # a finished match keeps the station it was played at
    assert (after[2]["station_name"], after[2]["queue_position"]) == ("Tisch 2", None)
    assert (after[3]["station_name"], after[3]["queue_position"]) == (None, 1)


@pytest.mark.asyncio
async def test_the_winner_stays_at_the_station_where_the_second_semi_feeder_ended(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations
    first = await ctx.round(1)
    await ctx.win(first[0])  # Tisch 1 -> match 3 goes there
    await ctx.win(first[1])  # Tisch 2 -> match 4 goes there; round 2 match 1 (fed by 1 and 2) is ready now

    second = await ctx.round(2)
    # both stations are busy (matches 3 and 4): the ready round-two match queues
    assert (second[0]["station_name"], second[0]["queue_position"]) == (None, 1)

    third, fourth = (await ctx.round(1))[2:]
    await ctx.win(fourth)  # Tisch 2 is free: the waiting round-two match takes it (first come, first served)
    assert (await ctx.round(2))[0]["station_name"] == "Tisch 2"
    await ctx.win(third)  # Tisch 1 is free: the second round-two match is ready and its winner stays at Tisch 1
    assert (await ctx.round(2))[1]["station_name"] == "Tisch 1"


@pytest.mark.asyncio
async def test_matches_of_two_rounds_are_played_at_the_same_time(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations
    first = await ctx.round(1)
    await ctx.win(first[0])
    await ctx.win(first[1])
    third = (await ctx.round(1))[2]
    await ctx.win(third)  # match 4 still runs at Tisch 2, the round-two match takes Tisch 1

    playing = [(x["round"], x["station_name"]) for x in await ctx.bracket() if x["status"] == "ready" and x["station_name"]]
    assert sorted(playing) == [(1, "Tisch 2"), (2, "Tisch 1")]


@pytest.mark.asyncio
async def test_a_new_station_takes_the_next_match_of_the_queue(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations

    resp = await ctx.client.post(f"/tournaments/{ctx.tid}/stations", json={}, headers=ctx.admin)

    assert resp.status_code == 201
    first = await ctx.round(1)
    assert [(x["station_name"], x["queue_position"]) for x in first] == [
        ("Tisch 1", None), ("Tisch 2", None), ("Tisch 3", None), (None, 1),
    ]


@pytest.mark.asyncio
async def test_a_deleted_station_sends_its_match_back_to_the_queue_first_in_line(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations
    station_two = (await ctx.stations())[1]

    assert (await ctx.client.delete(f"/tournaments/{ctx.tid}/stations/{station_two['id']}", headers=ctx.admin)).status_code == 204

    first = await ctx.round(1)
    assert first[0]["station_name"] == "Tisch 1"
    assert [(x["station_name"], x["queue_position"]) for x in first[1:]] == [(None, 1), (None, 2), (None, 3)]


@pytest.mark.asyncio
async def test_taking_a_result_back_brings_the_match_back_and_takes_the_next_one_off_its_station(
    eight_teams_two_stations: Ctx,
):
    ctx = eight_teams_two_stations
    first = await ctx.round(1)
    await ctx.win(first[0])
    await ctx.win(first[1])
    await ctx.win((await ctx.round(1))[3])  # Tisch 2 free -> round-two match 1 plays there

    assert (await ctx.round(2))[0]["station_name"] == "Tisch 2"
    resp = await ctx.client.delete(f"/matches/{first[1]['id']}/results", headers=ctx.admin)
    assert resp.status_code == 200

    reopened = await ctx.by_id(first[1]["id"])
    # the round-two match lost a team and its station; the reopened match gets its old station back
    assert (reopened["status"], reopened["station_name"]) == ("ready", "Tisch 2")
    second = (await ctx.round(2))[0]
    assert (second["status"], second["station_name"], second["queue_position"]) == ("waiting", None, None)


@pytest.mark.asyncio
async def test_with_more_stations_than_matches_everybody_plays_at_once(async_client: AsyncClient):
    ctx = await _tournament(async_client, 4, 5)
    first = await ctx.round(1)
    assert [x["station_name"] for x in first] == ["Tisch 1", "Tisch 2"]
    assert all(x["queue_position"] is None for x in first)


# -- status and start ------------------------------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_the_status_tells_who_waits_for_what(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations

    assert [x["status"] for x in await ctx.round(1)] == ["ready", "ready", "queued", "queued"]
    assert {x["status"] for x in await ctx.round(2)} == {"waiting"}


@pytest.mark.asyncio
async def test_a_match_at_its_station_can_be_started_and_the_start_taken_back(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations
    first = (await ctx.round(1))[0]

    assert (await ctx.client.post(f"/matches/{first['id']}/start", headers=ctx.admin)).status_code == 204
    live = await ctx.by_id(first["id"])
    assert (live["status"], live["station_name"]) == ("live", "Tisch 1")
    assert live["started_at"] is not None

    assert (await ctx.client.delete(f"/matches/{first['id']}/start", headers=ctx.admin)).status_code == 204
    back = await ctx.by_id(first["id"])
    assert (back["status"], back["started_at"]) == ("ready", None)


@pytest.mark.asyncio
async def test_a_match_without_a_station_cannot_start(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations
    queued = (await ctx.round(1))[2]

    resp = await ctx.client.post(f"/matches/{queued['id']}/start", headers=ctx.admin)

    assert resp.status_code == 409
    assert (await ctx.by_id(queued["id"]))["status"] == "queued"


@pytest.mark.asyncio
async def test_a_result_can_be_reported_without_a_start_also_for_a_queued_match(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations
    queued = (await ctx.round(1))[2]

    await ctx.win(queued)

    statuses = [x["status"] for x in await ctx.round(1)]
    assert statuses == ["ready", "ready", "finished", "queued"]  # the stations stay with the matches at them


@pytest.mark.asyncio
async def test_a_live_match_ends_with_its_result_and_frees_the_station(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations
    first = (await ctx.round(1))[0]
    await ctx.client.post(f"/matches/{first['id']}/start", headers=ctx.admin)

    await ctx.win(first)

    done = await ctx.by_id(first["id"])
    assert (done["status"], done["started_at"]) == ("finished", None)
    third = (await ctx.round(1))[2]
    assert (third["status"], third["station_name"]) == ("ready", "Tisch 1")
    resp = await ctx.client.post(f"/matches/{first['id']}/start", headers=ctx.admin)
    assert resp.status_code == 409  # a finished match does not start again


@pytest.mark.asyncio
async def test_a_live_match_whose_station_is_deleted_waits_again(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations
    second = (await ctx.round(1))[1]
    await ctx.client.post(f"/matches/{second['id']}/start", headers=ctx.admin)
    station_two = (await ctx.stations())[1]

    await ctx.client.delete(f"/tournaments/{ctx.tid}/stations/{station_two['id']}", headers=ctx.admin)

    back = await ctx.by_id(second["id"])
    assert (back["status"], back["started_at"], back["queue_position"]) == ("queued", None, 1)


@pytest.mark.asyncio
async def test_only_the_organization_starts_matches(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations
    first = (await ctx.round(1))[0]
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        outsider = await _login(ctx.client, 90)

    resp = await ctx.client.post(f"/matches/{first['id']}/start", headers=outsider)

    assert resp.status_code == 403


# -- certain station of a match still waiting for a team ---------------------------------------------------------------


@pytest.mark.asyncio
async def test_towards_the_end_a_waiting_match_knows_its_station(async_client: AsyncClient):
    ctx = await _tournament(async_client, 4, 3)  # two semi-finals and the final: a station for every match
    semi_one, semi_two = await ctx.round(1)

    await ctx.win(semi_one)

    final = (await ctx.round(2))[0]
    assert (final["status"], final["upcoming_station_name"], final["station_name"]) == ("waiting", "Tisch 2", None)
    await ctx.win(semi_two)
    final = (await ctx.round(2))[0]
    assert (final["status"], final["station_name"], final["upcoming_station_name"]) == ("ready", "Tisch 2", None)


@pytest.mark.asyncio
async def test_while_matches_queue_a_waiting_match_has_no_certain_station(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations
    await ctx.win((await ctx.round(1))[0])

    assert all(x["upcoming_station_name"] is None for x in await ctx.bracket())


@pytest.mark.asyncio
async def test_a_match_at_its_station_says_since_when(eight_teams_two_stations: Ctx):
    first, _, third, _ = await eight_teams_two_stations.round(1)
    assert first["on_station_at"] is not None
    assert third["on_station_at"] is None  # in the queue


@pytest.mark.asyncio
async def test_renaming_a_station_is_shown_live(eight_teams_two_stations: Ctx):
    ctx = eight_teams_two_stations
    before = (await ctx.client.get(f"/tournaments/{ctx.tid}", headers=ctx.admin)).json()["revision"]
    station = (await ctx.stations())[0]

    await ctx.client.patch(f"/tournaments/{ctx.tid}/stations/{station['id']}", json={"name": "Terrasse"}, headers=ctx.admin)

    assert (await ctx.client.get(f"/tournaments/{ctx.tid}", headers=ctx.admin)).json()["revision"] > before
    assert (await ctx.round(1))[0]["station_name"] == "Terrasse"
