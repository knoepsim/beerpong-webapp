"""The tables of a tournament: created with it, then added, renamed and deleted by the organizers."""
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.services.table_service import next_default_name, normalize_table_name
from app.core.exceptions import InvalidTableNameError
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
        resp = await self.client.get(f"/tournaments/{tid}/tables", headers=self.admin)
        assert resp.status_code == 200
        return [t["name"] for t in resp.json()]

    async def tables(self, tid: str) -> list[dict]:
        return (await self.client.get(f"/tournaments/{tid}/tables", headers=self.admin)).json()

    async def add(self, tid: str, name: str | None = None):
        return await self.client.post(f"/tournaments/{tid}/tables", json={"name": name}, headers=self.admin)


@pytest_asyncio.fixture
async def ctx(async_client: AsyncClient) -> Ctx:
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        admin = await _login(async_client, 1)
        player = await _login(async_client, 2)
    return Ctx(async_client, admin, player)


def test_names_are_cleaned_and_checked():
    assert normalize_table_name("  Tisch   am Pool ") == "Tisch am Pool"
    for bad in ("", "   ", "x" * 41):
        with pytest.raises(InvalidTableNameError):
            normalize_table_name(bad)


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
    assert next_default_name(names) == expected


@pytest.mark.asyncio
async def test_a_tournament_gets_as_many_tables_as_asked_named_tisch_n(ctx: Ctx):
    tid = await ctx.create(table_count=4)
    assert await ctx.names(tid) == ["Tisch 1", "Tisch 2", "Tisch 3", "Tisch 4"]


@pytest.mark.asyncio
async def test_a_tournament_has_one_table_unless_told_otherwise(ctx: Ctx):
    assert await ctx.names(await ctx.create()) == ["Tisch 1"]


@pytest.mark.asyncio
@pytest.mark.parametrize("count", [0, 101])
async def test_the_number_of_tables_at_creation_is_limited(ctx: Ctx, count: int):
    resp = await ctx.client.post(
        "/tournaments", json={**PLAYS, "name": "Cup", "start_time": FUTURE, "table_count": count}, headers=ctx.admin
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_the_tournament_does_not_carry_a_table_count_any_more(ctx: Ctx):
    tid = await ctx.create(table_count=3)
    tournament = (await ctx.client.get(f"/tournaments/{tid}", headers=ctx.admin)).json()
    assert "table_count" not in tournament


@pytest.mark.asyncio
async def test_a_table_added_without_name_is_called_tisch_n(ctx: Ctx):
    tid = await ctx.create(table_count=2)

    resp = await ctx.add(tid)

    assert resp.status_code == 201
    assert resp.json()["name"] == "Tisch 3"
    assert await ctx.names(tid) == ["Tisch 1", "Tisch 2", "Tisch 3"]


@pytest.mark.asyncio
async def test_a_table_can_be_added_with_a_name(ctx: Ctx):
    tid = await ctx.create()
    resp = await ctx.add(tid, "  Terrasse ")
    assert resp.json()["name"] == "Terrasse"
    assert await ctx.names(tid) == ["Tisch 1", "Terrasse"]


@pytest.mark.asyncio
async def test_names_stay_unique_whatever_the_case(ctx: Ctx):
    tid = await ctx.create()
    taken = await ctx.add(tid, "tisch 1")
    assert (taken.status_code, taken.json()["error_code"]) == (409, "TABLE_NAME_TAKEN")


@pytest.mark.asyncio
async def test_a_table_can_be_renamed_also_to_its_own_name_in_another_case(ctx: Ctx):
    tid = await ctx.create(table_count=2)
    first, second = await ctx.tables(tid)

    renamed = await ctx.client.patch(f"/tournaments/{tid}/tables/{first['id']}", json={"name": " Pool "}, headers=ctx.admin)
    assert (renamed.status_code, renamed.json()["name"]) == (200, "Pool")

    same = await ctx.client.patch(f"/tournaments/{tid}/tables/{first['id']}", json={"name": "POOL"}, headers=ctx.admin)
    assert same.status_code == 200

    clash = await ctx.client.patch(
        f"/tournaments/{tid}/tables/{second['id']}", json={"name": "pool"}, headers=ctx.admin
    )
    assert (clash.status_code, clash.json()["error_code"]) == (409, "TABLE_NAME_TAKEN")

    empty = await ctx.client.patch(f"/tournaments/{tid}/tables/{second['id']}", json={"name": "  "}, headers=ctx.admin)
    assert (empty.status_code, empty.json()["error_code"]) == (422, "INVALID_TABLE_NAME")


@pytest.mark.asyncio
async def test_a_table_can_be_deleted_but_not_the_last_one(ctx: Ctx):
    tid = await ctx.create(table_count=2)
    first, second = await ctx.tables(tid)

    assert (await ctx.client.delete(f"/tournaments/{tid}/tables/{first['id']}", headers=ctx.admin)).status_code == 204
    assert await ctx.names(tid) == ["Tisch 2"]

    last = await ctx.client.delete(f"/tournaments/{tid}/tables/{second['id']}", headers=ctx.admin)
    assert (last.status_code, last.json()["error_code"]) == (409, "LAST_TABLE")
    assert await ctx.names(tid) == ["Tisch 2"]


@pytest.mark.asyncio
async def test_after_deleting_the_default_name_goes_on_counting(ctx: Ctx):
    tid = await ctx.create(table_count=3)
    third = (await ctx.tables(tid))[2]
    await ctx.client.delete(f"/tournaments/{tid}/tables/{third['id']}", headers=ctx.admin)

    assert (await ctx.add(tid)).json()["name"] == "Tisch 3"


@pytest.mark.asyncio
async def test_there_are_at_most_100_tables(ctx: Ctx):
    tid = await ctx.create(table_count=100)
    resp = await ctx.add(tid)
    assert (resp.status_code, resp.json()["error_code"]) == (409, "TOO_MANY_TABLES")


@pytest.mark.asyncio
async def test_only_organizers_change_tables(ctx: Ctx):
    tid = await ctx.create(table_count=2)
    table = (await ctx.tables(tid))[0]

    assert (await ctx.client.post(f"/tournaments/{tid}/tables", json={}, headers=ctx.player)).status_code == 403
    assert (
        await ctx.client.patch(f"/tournaments/{tid}/tables/{table['id']}", json={"name": "x"}, headers=ctx.player)
    ).status_code == 403
    assert (await ctx.client.delete(f"/tournaments/{tid}/tables/{table['id']}", headers=ctx.player)).status_code == 403
    assert await ctx.names(tid) == ["Tisch 1", "Tisch 2"]


@pytest.mark.asyncio
async def test_tables_of_another_tournament_cannot_be_touched_through_this_one(ctx: Ctx):
    mine, other = await ctx.create(), await ctx.create()
    foreign = (await ctx.tables(other))[0]

    assert (
        await ctx.client.patch(f"/tournaments/{mine}/tables/{foreign['id']}", json={"name": "x"}, headers=ctx.admin)
    ).status_code == 404
    assert (await ctx.client.delete(f"/tournaments/{mine}/tables/{foreign['id']}", headers=ctx.admin)).status_code == 404


@pytest.mark.asyncio
async def test_who_may_see_the_tournament_may_see_its_tables(ctx: Ctx):
    public = await ctx.create(visibility="public")
    private = await ctx.create(visibility="private", join_policy="invite_only")

    assert (await ctx.client.get(f"/tournaments/{public}/tables")).status_code == 200
    assert (await ctx.client.get(f"/tournaments/{private}/tables", headers=ctx.player)).status_code == 403
