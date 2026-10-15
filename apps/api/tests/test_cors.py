"""Which browser origins may call the API directly."""
import pytest
from httpx import AsyncClient


async def _preflight(client: AsyncClient, origin: str):
    return await client.options(
        "/tournaments/me",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"},
    )


@pytest.mark.asyncio
async def test_the_configured_origin_may_call_the_api(async_client: AsyncClient):
    resp = await _preflight(async_client, "http://localhost:3000")
    assert resp.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert resp.headers["access-control-allow-credentials"] == "true"


@pytest.mark.asyncio
async def test_outside_production_a_local_address_may_call_it_too(async_client: AsyncClient):
    resp = await _preflight(async_client, "http://192.168.137.1:3000")
    assert resp.headers["access-control-allow-origin"] == "http://192.168.137.1:3000"
