"""The stations of a tournament: created with it, then added, renamed and deleted by the organizers."""
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.games import stations_of
from app.models.tournament import Game
from app.services.station_service import next_default_name, normalize_station_name
from app.core.exceptions import InvalidStationNameError
from tests.helpers import PLAYS

FUTURE = "2099-12-31T20:00:00Z"


async def _login(client: AsyncClient, n: int) -> dict:
    phone = f"+4915300000{n:02d}"
    await client.post("/auth/request-code", json={"phone_number": phone})
    token = (await client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class Ctx:
    def __init__(self, client: AsyncClient, admin: dict, player: dict):
        self.client, self.admin, self.player = client, admin, player

    async def create(self, **body) -> str:
        resp = await self.client.post(
            "/tournaments", json={**PLAYS, "name": "Cup", "start_time": FUTURE, **body}, headers=self.admin
        )
        assert resp.status_code == 201, resp.text
        return resp.json()["id"]

    async def names(self, tid: str) -> list[str]:
        resp = await self.client.get(f"/tournaments/{tid}/stations", headers=self.admin)
        assert resp.status_code == 200
        return [t["name"] for t in resp.json()]

    async def stations(self, tid: str) -> list[dict]:
        return (await self.client.get(f"/tournaments/{tid}/stations", headers=self.admin)).json()

    async def add(self, tid: str, name: str | None = None):
        return await self.client.post(f"/tournaments/{tid}/stations", json={"name": name}, headers=self.admin)


@pytest_asyncio.fixture
async def ctx(async_client: AsyncClient) -> Ctx:
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        admin = await _login(async_client, 1)
        player = await _login(async_client, 2)
    return Ctx(async_client, admin, player)


def test_names_are_cleaned_and_checked():
    assert normalize_station_name("  Tisch   am Pool ") == "Tisch am Pool"
    for bad in ("", "   ", "x" * 41):
        with pytest.raises(InvalidStationNameError):
            normalize_station_name(bad)


@pytest.mark.parametrize(
    ("names", "expected"),
    [
        ([], "Tisch 1"),
        (["Tisch 1", "Tisch 2"], "Tisch 3"),
        (["Tisch 1", "Tisch 3"], "Tisch 4"),  # a gap is not filled: the names keep ascending
        (["Tisch 2", "Garten"], "Tisch 3"),
        (["Garten", "tisch 7", "Tisch 7a"], "Tisch 1"),  # only exactly "Tisch n" counts
    ],
)
def test_the_default_name_is_one_above_the_highest_number(names, expected):
    assert next_default_name(names, stations_of(Game.BEERPONG)) == expected


@pytest.mark.asyncio
async def test_a_tournament_gets_as_many_stations_as_asked_named_tisch_n(ctx: Ctx):
    tid = await ctx.create(station_count=4)
    assert await ctx.names(tid) == ["Tisch 1", "Tisch 2", "Tisch 3", "Tisch 4"]


@pytest.mark.asyncio
async def test_a_tournament_has_one_station_unless_told_otherwise(ctx: Ctx):
    assert await ctx.names(await ctx.create()) == ["Tisch 1"]


@pytest.mark.asyncio
@pytest.mark.parametrize("count", [0, 101])
async def test_the_number_of_stations_at_creation_is_limited(ctx: Ctx, count: int):
    resp = await ctx.client.post(
        "/tournaments", json={**PLAYS, "name": "Cup", "start_time": FUTURE, "station_count": count}, headers=ctx.admin
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_the_tournament_does_not_carry_a_station_count_any_more(ctx: Ctx):
    tid = await ctx.create(station_count=3)
    tournament = (await ctx.client.get(f"/tournaments/{tid}", headers=ctx.admin)).json()
    assert "station_count" not in tournament


@pytest.mark.asyncio
async def test_a_station_added_without_name_is_called_tisch_n(ctx: Ctx):
    tid = await ctx.create(station_count=2)

    resp = await ctx.add(tid)

    assert resp.status_code == 201
    assert resp.json()["name"] == "Tisch 3"
    assert await ctx.names(tid) == ["Tisch 1", "Tisch 2", "Tisch 3"]


@pytest.mark.asyncio
async def test_a_station_can_be_added_with_a_name(ctx: Ctx):
    tid = await ctx.create()
    resp = await ctx.add(tid, "  Terrasse ")
    assert resp.json()["name"] == "Terrasse"
    assert await ctx.names(tid) == ["Tisch 1", "Terrasse"]


@pytest.mark.asyncio
async def test_names_stay_unique_whatever_the_case(ctx: Ctx):
    tid = await ctx.create()
    taken = await ctx.add(tid, "tisch 1")
    assert (taken.status_code, taken.json()["error_code"]) == (409, "STATION_NAME_TAKEN")


@pytest.mark.asyncio
async def test_a_station_can_be_renamed_also_to_its_own_name_in_another_case(ctx: Ctx):
    tid = await ctx.create(station_count=2)
    first, second = await ctx.stations(tid)

    renamed = await ctx.client.patch(f"/tournaments/{tid}/stations/{first['id']}", json={"name": " Pool "}, headers=ctx.admin)
    assert (renamed.status_code, renamed.json()["name"]) == (200, "Pool")

    same = await ctx.client.patch(f"/tournaments/{tid}/stations/{first['id']}", json={"name": "POOL"}, headers=ctx.admin)
    assert same.status_code == 200

    clash = await ctx.client.patch(
        f"/tournaments/{tid}/stations/{second['id']}", json={"name": "pool"}, headers=ctx.admin
    )
    assert (clash.status_code, clash.json()["error_code"]) == (409, "STATION_NAME_TAKEN")

    empty = await ctx.client.patch(f"/tournaments/{tid}/stations/{second['id']}", json={"name": "  "}, headers=ctx.admin)
    assert (empty.status_code, empty.json()["error_code"]) == (422, "INVALID_STATION_NAME")


@pytest.mark.asyncio
async def test_a_station_can_be_deleted_but_not_the_last_one(ctx: Ctx):
    tid = await ctx.create(station_count=2)
    first, second = await ctx.stations(tid)

    assert (await ctx.client.delete(f"/tournaments/{tid}/stations/{first['id']}", headers=ctx.admin)).status_code == 204
    assert await ctx.names(tid) == ["Tisch 2"]

    last = await ctx.client.delete(f"/tournaments/{tid}/stations/{second['id']}", headers=ctx.admin)
    assert (last.status_code, last.json()["error_code"]) == (409, "LAST_STATION")
    assert await ctx.names(tid) == ["Tisch 2"]


@pytest.mark.asyncio
async def test_after_deleting_the_default_name_goes_on_counting(ctx: Ctx):
    tid = await ctx.create(station_count=3)
    third = (await ctx.stations(tid))[2]
    await ctx.client.delete(f"/tournaments/{tid}/stations/{third['id']}", headers=ctx.admin)

    assert (await ctx.add(tid)).json()["name"] == "Tisch 3"


@pytest.mark.asyncio
async def test_there_are_at_most_100_stations(ctx: Ctx):
    tid = await ctx.create(station_count=100)
    resp = await ctx.add(tid)
    assert (resp.status_code, resp.json()["error_code"]) == (409, "TOO_MANY_STATIONS")


@pytest.mark.asyncio
async def test_only_organizers_change_stations(ctx: Ctx):
    tid = await ctx.create(station_count=2)
    station = (await ctx.stations(tid))[0]

    assert (await ctx.client.post(f"/tournaments/{tid}/stations", json={}, headers=ctx.player)).status_code == 403
    assert (
        await ctx.client.patch(f"/tournaments/{tid}/stations/{station['id']}", json={"name": "x"}, headers=ctx.player)
    ).status_code == 403
    assert (await ctx.client.delete(f"/tournaments/{tid}/stations/{station['id']}", headers=ctx.player)).status_code == 403
    assert await ctx.names(tid) == ["Tisch 1", "Tisch 2"]


@pytest.mark.asyncio
async def test_stations_of_another_tournament_cannot_be_touched_through_this_one(ctx: Ctx):
    mine, other = await ctx.create(), await ctx.create()
    foreign = (await ctx.stations(other))[0]

    assert (
        await ctx.client.patch(f"/tournaments/{mine}/stations/{foreign['id']}", json={"name": "x"}, headers=ctx.admin)
    ).status_code == 404
    assert (await ctx.client.delete(f"/tournaments/{mine}/stations/{foreign['id']}", headers=ctx.admin)).status_code == 404


@pytest.mark.asyncio
async def test_who_may_see_the_tournament_may_see_its_stations(ctx: Ctx):
    public = await ctx.create(visibility="public")
    private = await ctx.create(visibility="private", join_policy="invite_only")

    assert (await ctx.client.get(f"/tournaments/{public}/stations")).status_code == 200
    assert (await ctx.client.get(f"/tournaments/{private}/stations", headers=ctx.player)).status_code == 403
