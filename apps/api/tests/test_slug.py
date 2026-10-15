"""The address of a tournament: /t/{slug}, generated from the title and editable."""
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.core.exceptions import InvalidSlugError
from app.core.slug import normalize_slug, random_slug, slugify

FUTURE = "2099-12-31T20:00:00Z"


@pytest.mark.parametrize(
    ("title", "slug"),
    [
        ("Sommerfest 2026", "sommerfest-2026"),
        ("  Bierpong -- Cup!!  ", "bierpong-cup"),
        ("Größe & Äpfel", "groesse-aepfel"),
        ("🍺", "turnier"),
        ("ab", "ab-turnier"),
        ("New", "new-turnier"),
    ],
)
def test_the_title_becomes_a_readable_address(title, slug):
    assert slugify(title) == slug


def test_a_long_title_is_cut_at_a_word_and_stays_valid():
    slug = slugify("Das große jährliche Bierpong Turnier der Freunde vom Kegelverein Süd")
    assert len(slug) <= 40
    assert normalize_slug(slug) == slug
    assert not slug.endswith("-")


def test_a_typed_address_is_checked():
    assert normalize_slug("  Sommer-Fest ") == "sommer-fest"
    for bad in ["ab", "a" * 41, "mit leerzeichen", "-anfang", "ende-", "doppel--strich", "ümlaut", "admin", "invite"]:
        with pytest.raises(InvalidSlugError):
            normalize_slug(bad)


def test_random_addresses_avoid_look_alikes():
    assert all(c not in "0o1li" for c in random_slug(200))


@pytest_asyncio.fixture
async def organizer(async_client: AsyncClient) -> dict:
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        await async_client.post("/auth/request-code", json={"phone_number": "+4915700000042"})
        token = (
            await async_client.post("/auth/verify", json={"phone_number": "+4915700000042", "code": "123456"})
        ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create(client: AsyncClient, headers: dict, name: str) -> dict:
    resp = await client.post(
        "/tournaments", json={"name": name, "start_time": FUTURE, "visibility": "public_listed"}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_a_new_tournament_gets_its_title_as_address_and_a_number_if_taken(async_client, organizer):
    first = await _create(async_client, organizer, "Sommerfest")
    second = await _create(async_client, organizer, "Sommerfest")
    third = await _create(async_client, organizer, "Sommerfest")
    assert (first["slug"], second["slug"], third["slug"]) == ("sommerfest", "sommerfest-2", "sommerfest-3")


@pytest.mark.asyncio
async def test_the_address_leads_to_the_tournament_and_unknown_ones_are_404(async_client, organizer):
    created = await _create(async_client, organizer, "Herbst Cup")

    resp = await async_client.get(f"/tournaments/by-slug/{created['slug']}", headers=organizer)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]
    assert (await async_client.get("/tournaments/by-slug/herbst-cup", headers=organizer)).status_code == 200
    assert (await async_client.get("/tournaments/by-slug/HERBST-CUP", headers=organizer)).status_code == 200

    assert (await async_client.get("/tournaments/by-slug/gibt-es-nicht", headers=organizer)).status_code == 404


@pytest.mark.asyncio
async def test_the_organizer_can_change_the_address(async_client, organizer):
    created = await _create(async_client, organizer, "Cup A")

    resp = await async_client.patch(f"/tournaments/{created['id']}", json={"slug": "Mein-Cup"}, headers=organizer)

    assert resp.status_code == 200
    assert resp.json()["slug"] == "mein-cup"
    assert (await async_client.get("/tournaments/by-slug/cup-a", headers=organizer)).status_code == 404
    assert (await async_client.get("/tournaments/by-slug/mein-cup", headers=organizer)).status_code == 200


@pytest.mark.asyncio
async def test_an_address_cannot_be_taken_twice_or_be_invalid(async_client, organizer):
    first = await _create(async_client, organizer, "Cup One")
    second = await _create(async_client, organizer, "Cup Two")

    taken = await async_client.patch(f"/tournaments/{second['id']}", json={"slug": first["slug"]}, headers=organizer)
    assert (taken.status_code, taken.json()["error_code"]) == (409, "SLUG_TAKEN")

    same = await async_client.patch(f"/tournaments/{first['id']}", json={"slug": first["slug"]}, headers=organizer)
    assert same.status_code == 200, "keeping the own address is not a conflict"

    bad = await async_client.patch(f"/tournaments/{second['id']}", json={"slug": "admin"}, headers=organizer)
    assert (bad.status_code, bad.json()["error_code"]) == (422, "INVALID_SLUG")


@pytest.mark.asyncio
async def test_the_address_of_a_deleted_tournament_is_never_given_out_again(async_client, organizer):
    created = await _create(async_client, organizer, "Altes Turnier")
    assert (await async_client.delete(f"/tournaments/{created['id']}", headers=organizer)).status_code == 204

    assert (await async_client.get(f"/tournaments/by-slug/{created['slug']}", headers=organizer)).status_code == 404
    again = await _create(async_client, organizer, "Altes Turnier")
    assert again["slug"] == "altes-turnier-2"
