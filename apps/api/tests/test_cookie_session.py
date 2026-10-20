"""A browser session: HttpOnly cookies instead of tokens a script could read."""
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.core.config import settings
from app.core.security import ACCESS_COOKIE, CSRF_HEADER, REFRESH_COOKIE
from tests.helpers import PLAYS

PHONE = "+4915600000001"
JSON_HEADER = {CSRF_HEADER: "fetch"}


@pytest.fixture(autouse=True)
def cookie_paths(monkeypatch):
    """The test client talks to the API directly, not under /api like the browser."""
    monkeypatch.setattr(settings, "refresh_cookie_path", "/auth")


async def _login(client: AsyncClient, cookie_session: bool = True, phone: str = PHONE):
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        await client.post("/auth/request-code", json={"phone_number": phone})
    return await client.post(
        "/auth/verify", json={"phone_number": phone, "code": "123456", "cookie_session": cookie_session}
    )


def _set_cookie(resp, name: str) -> str:
    return next(h for h in resp.headers.get_list("set-cookie") if h.startswith(f"{name}="))


@pytest_asyncio.fixture
async def browser(async_client: AsyncClient) -> AsyncClient:
    resp = await _login(async_client)
    assert resp.status_code == 204
    return async_client


@pytest.mark.asyncio
async def test_a_browser_login_sets_http_only_cookies_and_gives_no_token_to_scripts(async_client: AsyncClient):
    resp = await _login(async_client)

    assert resp.status_code == 204
    assert resp.content == b""
    access, refresh = _set_cookie(resp, ACCESS_COOKIE), _set_cookie(resp, REFRESH_COOKIE)
    for cookie in (access, refresh):
        assert "HttpOnly" in cookie
        assert "SameSite=lax" in cookie
        assert f"Max-Age={settings.refresh_token_expire_days * 24 * 3600}" in cookie
    assert "Path=/;" in access + ";"
    assert "Path=/auth" in refresh


@pytest.mark.asyncio
async def test_scripts_still_get_their_tokens_in_the_body(async_client: AsyncClient):
    resp = await _login(async_client, cookie_session=False, phone="+4915600000002")

    assert resp.status_code == 200
    assert set(resp.json()) >= {"access_token", "refresh_token"}
    assert "set-cookie" not in resp.headers


@pytest.mark.asyncio
async def test_cookies_are_secure_in_production_only(async_client: AsyncClient, monkeypatch):
    plain = await _login(async_client, phone="+4915600000003")
    assert "Secure" not in _set_cookie(plain, ACCESS_COOKIE)

    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "sms_backend", "dummy")
    secure = await _login(async_client, phone="+4915600000004")
    assert "Secure" in _set_cookie(secure, ACCESS_COOKIE)
    assert "Secure" in _set_cookie(secure, REFRESH_COOKIE)


@pytest.mark.asyncio
async def test_the_session_cookie_logs_somebody_in(browser: AsyncClient):
    resp = await browser.get("/users/me")
    assert resp.status_code == 200
    assert resp.json()["phone_number"] == PHONE


@pytest.mark.asyncio
async def test_without_cookie_or_header_nobody_is_logged_in(async_client: AsyncClient):
    assert (await async_client.get("/users/me")).status_code == 401


@pytest.mark.asyncio
async def test_a_writing_request_with_only_the_cookie_needs_the_header_of_our_own_pages(browser: AsyncClient):
    refused = await browser.patch("/users/me", json={"name": "Ada"})
    assert refused.status_code == 403

    allowed = await browser.patch("/users/me", json={"name": "Ada"}, headers=JSON_HEADER)
    assert allowed.status_code == 200
    assert allowed.json()["name"] == "Ada"


@pytest.mark.asyncio
async def test_a_bearer_token_needs_no_such_header(async_client: AsyncClient):
    tokens = (await _login(async_client, cookie_session=False, phone="+4915600000005")).json()
    resp = await async_client.patch(
        "/users/me", json={"name": "Bea"}, headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_the_session_is_renewed_by_the_refresh_cookie_which_changes_every_time(browser: AsyncClient):
    old_refresh = browser.cookies.get(REFRESH_COOKIE)

    resp = await browser.post("/auth/refresh", headers=JSON_HEADER)

    assert resp.status_code == 204
    assert resp.content == b""
    assert browser.cookies.get(REFRESH_COOKIE) != old_refresh
    assert (await browser.get("/users/me")).status_code == 200


@pytest.mark.asyncio
async def test_an_old_refresh_cookie_ends_the_session_and_the_browser_loses_its_cookies(
    async_client: AsyncClient, browser: AsyncClient
):
    old_refresh = browser.cookies.get(REFRESH_COOKIE)
    await browser.post("/auth/refresh", headers=JSON_HEADER)
    browser.cookies.set(REFRESH_COOKIE, old_refresh, path="/auth")  # a stolen copy of the first token

    resp = await browser.post("/auth/refresh", headers=JSON_HEADER)

    assert resp.status_code == 401
    assert "Max-Age=0" in _set_cookie(resp, ACCESS_COOKIE) or "expires" in _set_cookie(resp, ACCESS_COOKIE).lower()


@pytest.mark.asyncio
async def test_refreshing_without_a_session_is_refused(async_client: AsyncClient):
    resp = await async_client.post("/auth/refresh", headers=JSON_HEADER)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refreshing_by_cookie_needs_the_header_of_our_own_pages(browser: AsyncClient):
    assert (await browser.post("/auth/refresh")).status_code == 403


@pytest.mark.asyncio
async def test_a_script_renews_with_its_refresh_token_in_the_body_as_before(async_client: AsyncClient):
    tokens = (await _login(async_client, cookie_session=False, phone="+4915600000006")).json()
    resp = await async_client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert resp.status_code == 200
    assert resp.json()["access_token"]


@pytest.mark.asyncio
async def test_logging_out_revokes_the_refresh_token_and_clears_the_cookies(browser: AsyncClient):
    refresh = browser.cookies.get(REFRESH_COOKIE)

    resp = await browser.post("/auth/logout", headers=JSON_HEADER)

    assert resp.status_code == 204
    assert _set_cookie(resp, ACCESS_COOKIE) and _set_cookie(resp, REFRESH_COOKIE)
    # the token that was stolen before the logout is worthless now
    stolen = await browser.post("/auth/refresh", json={"refresh_token": refresh})
    assert stolen.status_code in (401, 403)


@pytest.mark.asyncio
async def test_logging_out_without_a_session_is_harmless(async_client: AsyncClient):
    assert (await async_client.post("/auth/logout", headers=JSON_HEADER)).status_code == 204


@pytest.mark.asyncio
async def test_the_live_stream_knows_the_user_from_the_cookie(browser: AsyncClient, monkeypatch):
    from conftest import TestingSessionLocal

    monkeypatch.setattr(settings, "sse_heartbeat_seconds", 0.05)
    monkeypatch.setattr(settings, "sse_max_seconds", 0.2)
    monkeypatch.setattr("app.routers.events.async_session", TestingSessionLocal)
    created = await browser.post(
        "/tournaments",
        json={**PLAYS, "name": "Cup", "start_time": "2099-12-31T20:00:00Z", "visibility": "private", "join_policy": "invite_only"},
        headers=JSON_HEADER,
    )
    tid = created.json()["id"]

    assert (await browser.get(f"/tournaments/{tid}/events")).status_code == 200

    browser.cookies.clear()
    assert (await browser.get(f"/tournaments/{tid}/events")).status_code == 403
