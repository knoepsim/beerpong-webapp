"""Abuse protection around SMS login: rate limits, attempt limits, token revocation."""
import pytest
from httpx import AsyncClient
from pydantic import ValidationError

from app.core.config import Settings, settings

PHONE = "+491760000001"


async def request_code(client: AsyncClient, phone: str = PHONE):
    return await client.post("/auth/request-code", json={"phone_number": phone})


async def verify(client: AsyncClient, code: str, phone: str = PHONE):
    return await client.post("/auth/verify", json={"phone_number": phone, "code": code})


@pytest.fixture
def no_cooldown(monkeypatch):
    monkeypatch.setattr(settings, "sms_resend_cooldown_seconds", 0)


@pytest.mark.asyncio
async def test_resend_cooldown(async_client: AsyncClient):
    assert (await request_code(async_client)).status_code == 204
    resp = await request_code(async_client)
    assert resp.status_code == 429
    assert resp.json()["error_code"] == "TOO_MANY_REQUESTS"
    # other numbers are not affected
    assert (await request_code(async_client, "+491760000002")).status_code == 204


@pytest.mark.asyncio
async def test_hourly_request_limit(async_client: AsyncClient, no_cooldown, monkeypatch):
    monkeypatch.setattr(settings, "sms_max_requests_per_hour", 3)
    for _ in range(3):
        assert (await request_code(async_client)).status_code == 204
    assert (await request_code(async_client)).status_code == 429


@pytest.mark.asyncio
async def test_code_is_burned_after_too_many_wrong_attempts(async_client: AsyncClient, no_cooldown):
    await request_code(async_client)
    for _ in range(settings.sms_max_verify_attempts):
        assert (await verify(async_client, "000000")).status_code == 401
    # even the correct code no longer works
    assert (await verify(async_client, "123456")).status_code == 401

    await request_code(async_client)
    assert (await verify(async_client, "123456")).status_code == 200


@pytest.mark.asyncio
async def test_wrong_attempts_below_limit_do_not_block(async_client: AsyncClient):
    await request_code(async_client)
    assert (await verify(async_client, "000000")).status_code == 401
    assert (await verify(async_client, "123456")).status_code == 200


@pytest.mark.asyncio
async def test_new_code_invalidates_older_ones(async_client: AsyncClient, no_cooldown, monkeypatch):
    codes = iter(["111111", "222222"])
    monkeypatch.setattr("app.services.auth_service.generate_sms_code", lambda: next(codes))
    await request_code(async_client)
    await request_code(async_client)
    assert (await verify(async_client, "111111")).status_code == 401
    assert (await verify(async_client, "222222")).status_code == 200


@pytest.mark.asyncio
async def test_phone_change_revokes_refresh_tokens(async_client: AsyncClient):
    await request_code(async_client)
    tokens = (await verify(async_client, "123456")).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    new_phone = "+491760000099"
    assert (
        await async_client.post("/users/me/phone/request", json={"new_phone_number": new_phone}, headers=headers)
    ).status_code == 204
    resp = await async_client.post(
        "/users/me/phone/verify", json={"new_phone_number": new_phone, "code": "123456"}, headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["phone_number"] == new_phone

    refresh = await async_client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh.status_code == 401


def test_production_rejects_insecure_defaults():
    with pytest.raises(ValidationError):
        Settings(environment="production", sms_backend="dummy", secret_key="x" * 40)
    with pytest.raises(ValidationError):
        Settings(environment="production", sms_backend="httpsms")  # default secret key
    Settings(environment="production", sms_backend="httpsms", secret_key="x" * 40)
    Settings(environment="development")  # dummy + default key stay fine locally
