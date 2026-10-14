"""Only German mobile numbers are accepted, so SMS stay inside a standard mobile flat rate."""
import pytest
from httpx import AsyncClient

from app.core.phone import normalize_german_mobile


@pytest.mark.parametrize(
    "raw",
    [
        "+4915112345678",
        "+49 151 1234 5678",
        "004915112345678",
        "015112345678",
        "0151/12345678",
        "+49 0151 12345678",  # common mistake: trunk zero after +49
        "+491761234567",
        "01761234567",
        "+491621234567",
        "+491601234567",
        "+4915731234567",
    ],
)
def test_german_mobile_numbers_are_normalized(raw: str):
    result = normalize_german_mobile(raw)
    assert result.startswith("+49") and result[1:].isdigit()
    assert result in {"+4915112345678", "+491761234567", "+491621234567", "+491601234567", "+4915731234567"}


@pytest.mark.parametrize(
    "raw",
    [
        "+4990012345678",  # 0900 premium rate
        "+4918012345678",  # 0180 service number
        "+491371234567",  # 0137 mass traffic
        "+4911833",  # 118xx directory
        "+49700123456",  # 0700 personal number
        "+493012345678",  # landline Berlin
        "+4932123456789",  # 032 nomadic
        "+491641234567",  # pager range
        "+491691234567",  # pager range
        "+4915112",  # too short
        "+491511234567890123",  # too long
        "+436601234567",  # Austria
        "+12025550123",  # USA
        "+447911123456",  # UK
        "0900123456",
        "abc",
        "",
    ],
)
def test_other_numbers_are_rejected(raw: str):
    with pytest.raises(ValueError):
        normalize_german_mobile(raw)


@pytest.mark.asyncio
@pytest.mark.parametrize("phone", ["+4990012345678", "+436601234567", "+4930123456"])
async def test_endpoints_reject_non_german_mobile(async_client: AsyncClient, phone: str):
    resp = await async_client.post("/auth/request-code", json={"phone_number": phone})
    assert resp.status_code == 422
    assert "deutsche Handynummern" in resp.text

    resp = await async_client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_national_format_logs_in_as_same_user_as_e164(async_client: AsyncClient):
    await async_client.post("/auth/request-code", json={"phone_number": "0151 1234 5678"})
    tokens = (await async_client.post("/auth/verify", json={"phone_number": "+4915112345678", "code": "123456"})).json()
    me = await async_client.get("/users/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.json()["phone_number"] == "+4915112345678"
