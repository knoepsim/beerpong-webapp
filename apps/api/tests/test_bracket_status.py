"""The bracket reports status, winner and cups itself, the UI does not have to infer them."""
import uuid

import pytest
from httpx import AsyncClient

from app.core.database import get_db
from app.core.security import create_access_token
from app.models.tournament_role import TournamentRoleType, TournamentUserRole
from app.models.user import User
from app.models.tournament import TournamentPhase
from app.schemas.match import MatchStatus
from app.schemas.result import ResultCreate
from main import app
from tests.helpers import generate_started_tournament

USER = uuid.uuid4()


def _by_round(bracket, round_number: int):
    return sorted((m for m in bracket.matches if m.round == round_number), key=lambda m: m.position)


@pytest.mark.asyncio
async def test_fresh_bracket_has_ready_and_waiting_matches_and_no_winner():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await generate_started_tournament(db, 4)
        bracket = await service.get_bracket(tournament.id)

        assert [m.status for m in _by_round(bracket, 1)] == [MatchStatus.READY, MatchStatus.READY]
        assert _by_round(bracket, 2)[0].status == MatchStatus.WAITING
        assert all(m.winner_team_id is None and m.cups_left is None for m in bracket.matches)
        assert bracket.champion_team_id is None


@pytest.mark.asyncio
async def test_a_result_sets_status_winner_and_cups():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await generate_started_tournament(db, 4)
        first = _by_round(await service.get_bracket(tournament.id), 1)[0]

        await service.report_result(first.id, ResultCreate(winner_team_id=first.team_b_id, cups_left=3), USER)
        match = next(m for m in (await service.get_bracket(tournament.id)).matches if m.id == first.id)

        assert match.status == MatchStatus.FINISHED
        assert match.winner_team_id == first.team_b_id
        assert match.cups_left == 3


@pytest.mark.asyncio
async def test_modified_and_deleted_results_are_followed():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await generate_started_tournament(db, 4)
        first = _by_round(await service.get_bracket(tournament.id), 1)[0]
        await service.report_result(first.id, ResultCreate(winner_team_id=first.team_a_id, cups_left=2), USER)

        await service.modify_result(first.id, ResultCreate(winner_team_id=first.team_b_id, cups_left=5), USER)
        match = next(m for m in (await service.get_bracket(tournament.id)).matches if m.id == first.id)
        assert (match.winner_team_id, match.cups_left) == (first.team_b_id, 5)

        await service.delete_result(first.id, USER)
        match = next(m for m in (await service.get_bracket(tournament.id)).matches if m.id == first.id)
        assert (match.status, match.winner_team_id, match.cups_left) == (MatchStatus.READY, None, None)


@pytest.mark.asyncio
async def test_champion_is_the_winner_of_the_final():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await generate_started_tournament(db, 4)
        for match in _by_round(await service.get_bracket(tournament.id), 1):
            await service.report_result(match.id, ResultCreate(winner_team_id=match.team_a_id), USER)
        final = _by_round(await service.get_bracket(tournament.id), 2)[0]
        assert final.status == MatchStatus.READY

        await service.report_result(final.id, ResultCreate(winner_team_id=final.team_b_id, cups_left=1), USER)

        assert (await service.get_bracket(tournament.id)).champion_team_id == final.team_b_id


@pytest.mark.asyncio
async def test_the_result_of_the_final_finishes_and_reopens_the_tournament():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await generate_started_tournament(db, 2)
        final = _by_round(await service.get_bracket(tournament.id), 1)[0]
        assert tournament.finished_at is None
        assert tournament.phase == TournamentPhase.RUNNING

        await service.report_result(final.id, ResultCreate(winner_team_id=final.team_a_id, cups_left=3), USER)
        assert tournament.finished_at is not None
        assert tournament.phase == TournamentPhase.FINISHED

        await service.modify_result(final.id, ResultCreate(winner_team_id=final.team_b_id, cups_left=1), USER)
        assert tournament.phase == TournamentPhase.FINISHED, "a correction does not reopen it"

        await service.delete_result(final.id, USER)
        assert tournament.finished_at is None
        assert tournament.phase == TournamentPhase.RUNNING


@pytest.mark.asyncio
async def test_a_result_before_the_final_does_not_finish_the_tournament():
    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await generate_started_tournament(db, 4)
        first = _by_round(await service.get_bracket(tournament.id), 1)[0]

        await service.report_result(first.id, ResultCreate(winner_team_id=first.team_a_id), USER)

        assert tournament.finished_at is None


@pytest.mark.asyncio
async def test_a_match_fed_by_two_byes_is_ready_from_the_start():
    """With 5 teams, two byes meet in round two: no feeder match, but both teams are known."""
    async for db in app.dependency_overrides[get_db]():
        service, tournament, _ = await generate_started_tournament(db, 5)
        bracket = await service.get_bracket(tournament.id)

        round_two = _by_round(bracket, 2)
        assert any(m.status == MatchStatus.READY for m in round_two)
        assert all(m.status in (MatchStatus.READY, MatchStatus.WAITING) for m in bracket.matches)


@pytest.mark.asyncio
async def test_api_returns_the_new_fields(async_client: AsyncClient):
    async for db in app.dependency_overrides[get_db]():
        _, tournament, teams = await generate_started_tournament(db, 2)
        await db.commit()
        # the test API shares the same in-memory database, an admin is needed to read private tournaments
        user = User(phone_number="+4915100000001", name="Orga")
        db.add(user)
        await db.flush()
        db.add(TournamentUserRole(tournament_id=tournament.id, user_id=user.id, role=TournamentRoleType.ADMIN))
        await db.commit()
        headers = {"Authorization": f"Bearer {create_access_token(user.id)}"}

    resp = await async_client.get(f"/tournaments/{tournament.id}/bracket", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["champion_team_id"] is None
    assert body["matches"][0]["status"] == "ready"
    assert {"winner_team_id", "cups_left"} <= set(body["matches"][0])
