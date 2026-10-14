"""The dummy-tournament seed script: reusable accounts/teams, real start and result flow."""
import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.core.database import get_db
from app.core.security import verify_access_token
from app.models.match import Match
from app.models.result import Result
from app.models.team import Team
from app.models.tournament import Tournament, TournamentTeam
from app.models.user import User
from main import app
from scripts.seed_dummy_tournaments import (
    PHONE_PREFIX,
    create_tournament,
    delete_dummy_tournaments,
    dummy_token,
    player_phone,
)

OWNER = "+4915100000001"


@pytest_asyncio.fixture
async def db():
    """A session of the test database (same one the API tests use) with an organizer in it."""
    generator = app.dependency_overrides[get_db]()
    session = await generator.__anext__()
    session.add(User(phone_number=OWNER, name="Organizer"))
    await session.flush()
    yield session
    await generator.aclose()


async def _count(db, model, *where) -> int:
    return (await db.execute(select(func.count()).select_from(model).where(*where))).scalar_one()


@pytest.mark.asyncio
async def test_accounts_and_teams_are_reused_between_runs(db):
    first = await create_tournament(db, teams=6, state="fresh", owner_phone=OWNER)
    second = await create_tournament(db, teams=6, state="fresh", owner_phone=OWNER)

    assert await _count(db, User, User.phone_number.startswith(PHONE_PREFIX)) == 12
    assert await _count(db, Team, Team.name.startswith("Dummy Team")) == 6
    assert await _count(db, Tournament, Tournament.name.startswith("Dummy ")) == 1, "same name is replaced"
    assert first["name"] == second["name"]


@pytest.mark.asyncio
async def test_more_teams_only_add_the_missing_ones(db):
    await create_tournament(db, teams=4, state="fresh", owner_phone=OWNER)
    await create_tournament(db, teams=6, state="fresh", owner_phone=OWNER)

    assert await _count(db, User, User.phone_number.startswith(PHONE_PREFIX)) == 12
    assert await _count(db, Team, Team.name.startswith("Dummy Team")) == 6
    assert await _count(db, Tournament, Tournament.name.startswith("Dummy ")) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize(("state", "played", "expected_results"), [("fresh", 0.0, 0), ("running", 0.6, 3), ("finished", 1.0, 5)])
async def test_states_play_the_expected_share_of_matches(db, state: str, played: float, expected_results: int):
    info = await create_tournament(db, teams=6, played=played, state=state, owner_phone=OWNER)

    assert info["matches"] == 5, "n teams need n-1 matches"
    assert info["played"] == expected_results
    assert await _count(db, Result) == expected_results
    assert await _count(db, Match, Match.tournament_id == info["id"]) == 5


@pytest.mark.asyncio
async def test_a_finished_tournament_has_a_champion(db):
    info = await create_tournament(db, teams=8, played=1.0, owner_phone=OWNER)

    final = (await db.execute(select(Match).where(Match.tournament_id == info["id"], Match.next_match_id.is_(None)))).scalar_one()
    champion = (await db.execute(select(Result.winner_team_id).where(Result.match_id == final.id))).scalar_one()
    assert champion in (final.team_a_id, final.team_b_id)
    assert info["played"] == 7


@pytest.mark.asyncio
async def test_delete_keeps_players_and_teams(db):
    await create_tournament(db, teams=4, played=1.0, owner_phone=OWNER)

    assert await delete_dummy_tournaments(db) == 1

    assert await _count(db, Tournament) == 0
    assert await _count(db, Match) == 0
    assert await _count(db, Result) == 0
    assert await _count(db, User, User.phone_number.startswith(PHONE_PREFIX)) == 8
    assert await _count(db, Team, Team.name.startswith("Dummy Team")) == 4


@pytest.mark.asyncio
async def test_custom_names_stay_deletable_and_unknown_owner_is_an_error(db):
    info = await create_tournament(db, teams=2, owner_phone=OWNER, name="Mein Test")
    assert info["name"] == "Dummy Mein Test"
    assert await delete_dummy_tournaments(db) == 1

    with pytest.raises(SystemExit):
        await create_tournament(db, teams=2, owner_phone="+4915100009999")


@pytest.mark.asyncio
async def test_players_have_a_complete_profile_so_they_can_log_in_without_onboarding(db):
    db.add(User(phone_number=player_phone(1), name="Dummy Spieler 1"))  # an older dummy without e-mail
    await db.flush()
    await create_tournament(db, teams=2, state="fresh", owner_phone=OWNER)

    players = (await db.execute(select(User).where(User.phone_number.startswith(PHONE_PREFIX)))).scalars().all()
    assert len(players) == 4
    assert all(p.email and p.name for p in players)


@pytest.mark.asyncio
async def test_token_belongs_to_the_dummy_player(db):
    token = await dummy_token(db, 3)
    user = (await db.execute(select(User).where(User.phone_number == player_phone(3)))).scalar_one()
    assert verify_access_token(token) == user.id


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("state", "phase", "checked_in"),
    [("registration", "registration", 0), ("checkin", "checkin", 3)],
)
async def test_preparation_states_stay_unstarted_in_their_phase(db, state, phase, checked_in):
    info = await create_tournament(db, teams=6, state=state, played=None, owner_phone=OWNER)

    tournament = (await db.execute(select(Tournament).where(Tournament.id == info["id"]))).scalar_one()
    assert tournament.phase.value == phase
    assert tournament.started_at is None
    assert await _count(db, Match, Match.tournament_id == tournament.id) == 0
    assert await _count(db, TournamentTeam, TournamentTeam.tournament_id == tournament.id, TournamentTeam.is_checked_in) == checked_in
