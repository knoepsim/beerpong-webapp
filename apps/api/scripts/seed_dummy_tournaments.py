"""Test tournaments with dummy players and teams (local development tool).

Dummy players and teams follow a fixed scheme and stay in the database, so they can be reused:
    player n   phone +4915899{n:06d}, name "Dummy Spieler n", e-mail dummyN@example.test
    team k     name "Dummy Team kk", players 2k-1 and 2k
    tournament "Dummy {teams} Teams – {state}"

Usage (from apps/api):
    uv run python -m scripts.seed_dummy_tournaments create --teams 28 --state running
    uv run python -m scripts.seed_dummy_tournaments seed       # one tournament per phase: registration, check-in, running, finished
    uv run python -m scripts.seed_dummy_tournaments delete
    uv run python -m scripts.seed_dummy_tournaments token 5
"""
import argparse
import asyncio
import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session
from app.core.security import create_access_token
from app.models.match import Match
from app.models.result import Result
from app.models.team import Team, TeamMember
from app.models.tournament import Game, Tournament, TournamentMode, TournamentTeam, TournamentVisibility
from app.models.tournament_role import TournamentUserRole
from app.models.tournament_table import TournamentTable
from app.models.user import User
from app.schemas.result import ResultCreate
from app.schemas.tournament import TournamentCreate
from app.services.bracket_service import BracketService
from app.services.lifecycle_service import LifecycleService
from app.services.tournament_service import TournamentService

PHONE_PREFIX = "+4915899"
TOURNAMENT_PREFIX = "Dummy "
# state -> (label, share of matches played); None = not started yet (still in the registration / check-in phase)
STATES: dict[str, tuple[str, float | None]] = {
    "registration": ("Anmeldung offen", None),
    "checkin": ("Check-in offen", None),
    "both": ("Anmeldung und Check-in offen", None),
    "fresh": ("frisch", 0.0),
    "running": ("laufend", 0.6),
    "finished": ("beendet", 1.0),
}


def player_phone(n: int) -> str:
    return f"{PHONE_PREFIX}{n:06d}"


def player_email(n: int) -> str:
    return f"dummy{n}@example.test"


def team_name(k: int) -> str:
    return f"Dummy Team {k:02d}"


async def ensure_players(db: AsyncSession, count: int) -> list[User]:
    """Players 1..count, existing ones are reused."""
    phones = [player_phone(n) for n in range(1, count + 1)]
    existing = {u.phone_number: u for u in (await db.execute(select(User).where(User.phone_number.in_(phones)))).scalars()}
    players = []
    for n, phone in enumerate(phones, start=1):
        user = existing.get(phone)
        if user is None:
            user = User(phone_number=phone, name=f"Dummy Spieler {n}", email=player_email(n))
            db.add(user)
        elif user.email is None:
            user.email = player_email(n)  # complete profile: the app skips the onboarding for the login
        players.append(user)
    await db.flush()
    return players


async def ensure_teams(db: AsyncSession, count: int) -> list[Team]:
    """Teams 1..count with their two players, existing ones are reused."""
    players = await ensure_players(db, count * 2)
    teams = []
    for k in range(1, count + 1):
        members = [players[2 * k - 2], players[2 * k - 1]]
        team = (
            await db.execute(
                select(Team)
                .join(TeamMember, TeamMember.team_id == Team.id)
                .where(Team.name == team_name(k), Team.is_deleted == False, TeamMember.user_id == members[0].id)  # noqa: E712
            )
        ).scalars().first()
        if team is None:
            team = Team(name=team_name(k))
            db.add(team)
            await db.flush()
        present = set((await db.execute(select(TeamMember.user_id).where(TeamMember.team_id == team.id))).scalars())
        for member in members:
            if member.id not in present:
                db.add(TeamMember(team_id=team.id, user_id=member.id))
        teams.append(team)
    await db.flush()
    return teams


async def delete_dummy_tournaments(db: AsyncSession, name: str | None = None) -> int:
    """Remove dummy tournaments (all, or one by name) including matches and results. Players and teams stay."""
    stmt = select(Tournament.id).where(Tournament.name.startswith(TOURNAMENT_PREFIX))
    if name is not None:
        stmt = stmt.where(Tournament.name == name)
    ids = list((await db.execute(stmt)).scalars())
    if not ids:
        return 0
    match_ids = select(Match.id).where(Match.tournament_id.in_(ids))
    await db.execute(delete(Result).where(Result.match_id.in_(match_ids)))
    await db.execute(update(Match).where(Match.tournament_id.in_(ids)).values(next_match_id=None))
    await db.execute(delete(Match).where(Match.tournament_id.in_(ids)))
    await db.execute(delete(TournamentTable).where(TournamentTable.tournament_id.in_(ids)))
    await db.execute(delete(TournamentTeam).where(TournamentTeam.tournament_id.in_(ids)))
    await db.execute(delete(TournamentUserRole).where(TournamentUserRole.tournament_id.in_(ids)))
    await db.execute(delete(Tournament).where(Tournament.id.in_(ids)))
    return len(ids)


def default_owner() -> str:
    phones = [p.strip() for p in settings.super_admin_phones.split(",") if p.strip()]
    if not phones:
        raise SystemExit("Kein Besitzer: --owner angeben oder SUPER_ADMIN_PHONES setzen.")
    return phones[0]


def tournament_name(teams: int, played: float | None, state: str | None) -> str:
    label = STATES[state][0] if state else f"{round(played * 100)} % gespielt"
    return f"{TOURNAMENT_PREFIX}{teams} Teams – {label}"


def _schedule(state: str | None) -> dict:
    """Registration deadline and check-in times that put the tournament into the given preparation phase."""
    now = datetime.now(UTC)
    if state == "registration":  # registration open, closes by itself in 1 h; check-in opens by itself in 2 h
        return {
            "registration_end_time": now + timedelta(hours=1),
            "registration_auto_close": True,
            "checkin_enabled": True,
            "checkin_start_time": now + timedelta(hours=2),
            "checkin_auto_open": True,
        }
    if state == "checkin":  # registration closed by its deadline, check-in opened by its time
        return {
            "registration_end_time": now - timedelta(minutes=10),
            "registration_auto_close": True,
            "checkin_enabled": True,
            "checkin_start_time": now - timedelta(minutes=5),
            "checkin_auto_open": True,
        }
    if state == "both":  # no deadline, so registration stays open while check-in has begun
        return {"checkin_enabled": True, "checkin_start_time": now - timedelta(minutes=5), "checkin_auto_open": True}
    return {}


async def create_tournament(
    db: AsyncSession,
    *,
    teams: int = 28,
    tables: int = 8,
    played: float | None = 0.0,
    state: str | None = None,
    owner_phone: str | None = None,
    name: str | None = None,
) -> dict:
    """Create (or replace) a dummy tournament. With `played` it is started and that share of its matches is played;
    without (`None`) it stays in the registration phase, or in the check-in phase if `state` is "checkin" / "both"."""
    owner = (await db.execute(select(User).where(User.phone_number == (owner_phone or default_owner())))).scalar_one_or_none()
    if owner is None:
        raise SystemExit(f"Besitzer {owner_phone or default_owner()} existiert nicht. Erst in der App anmelden oder --owner angeben.")

    name = name or tournament_name(teams, played, state)
    if not name.startswith(TOURNAMENT_PREFIX):
        name = TOURNAMENT_PREFIX + name  # keeps every dummy tournament findable by `delete`
    await delete_dummy_tournaments(db, name)

    team_rows = await ensure_teams(db, teams)
    tournament = await TournamentService(db).create_tournament(
        TournamentCreate(
            name=name,
            location="Dummy-Garten",
            description=f"Testturnier mit {teams} Dummy-Teams, erzeugt mit scripts/seed_dummy_tournaments.py.",
            start_time=datetime.now(UTC) + timedelta(hours=4 if state == "registration" else 1),
            **_schedule(state),
            table_count=tables,
            game=Game.BEERPONG,
            mode=TournamentMode.SINGLE_ELIMINATION,
            visibility=TournamentVisibility.PUBLIC,
        ),
        owner.id,
    )
    await db.flush()
    for i, team in enumerate(team_rows):
        # during check-in about half of the teams have already arrived
        db.add(TournamentTeam(tournament_id=tournament.id, team_id=team.id, is_checked_in=state in ("checkin", "both") and i % 2 == 0))
    await db.flush()

    if played is None:
        return {"id": tournament.id, "slug": tournament.slug, "name": name, "teams": teams, "matches": 0, "rounds": 0, "played": 0}

    await LifecycleService(db).start_tournament(tournament.id)

    bracket_service = BracketService(db)
    total = len((await bracket_service.get_bracket(tournament.id)).matches)
    target = round(played * total)
    # Zufällige Testdaten für lokale Dummy-Turniere, kein Sicherheitsbezug
    rng = random.Random()  # NOSONAR
    done: set = set()
    while len(done) < target:
        matches = (await bracket_service.get_bracket(tournament.id)).matches
        ready = [m for m in matches if m.team_a_id and m.team_b_id and m.id not in done]
        match = min(ready, key=lambda m: (m.round, m.position))
        winner = rng.choice([match.team_a_id, match.team_b_id])  # NOSONAR
        await bracket_service.report_result(
            match.id, ResultCreate(winner_team_id=winner, cups_left=rng.randint(1, 10)), owner.id  # NOSONAR
        )
        done.add(match.id)

    bracket = await bracket_service.get_bracket(tournament.id)
    return {
        "id": tournament.id,
        "slug": tournament.slug,
        "name": name,
        "teams": teams,
        "matches": total,
        "rounds": bracket.total_rounds,
        "played": len(done),
    }


async def dummy_token(db: AsyncSession, n: int) -> str:
    """Bearer token of dummy player n (created if needed), for API calls and tests."""
    player = (await ensure_players(db, n))[n - 1]
    return create_access_token(player.id)


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create", help="create (or replace) a dummy tournament")
    create.add_argument("--teams", type=int, default=28)
    create.add_argument("--tables", type=int, default=8, help="number of tables (default 8)")
    create.add_argument("--state", choices=list(STATES), default="fresh")
    create.add_argument("--played", type=float, help="share of matches played (0.0 - 1.0), overrides --state")
    create.add_argument("--owner", help="phone of the organizer (default: first SUPER_ADMIN_PHONES)")
    create.add_argument("--name", help="tournament name (default: scheme)")

    seed = sub.add_parser("seed", help="one tournament per phase (registration, check-in, both open, running, finished)")
    seed.add_argument("--teams", type=int, default=28)
    seed.add_argument("--owner", help="phone of the organizer (default: first SUPER_ADMIN_PHONES)")

    sub.add_parser("delete", help="delete all dummy tournaments (players and teams stay)")

    token = sub.add_parser("token", help="print a bearer token for dummy player N")
    token.add_argument("n", type=int)

    args = parser.parse_args()
    async with async_session() as db:
        if args.command == "seed":
            for state in ("registration", "checkin", "both", "running", "finished"):
                info = await create_tournament(
                    db, teams=args.teams, played=STATES[state][1], state=state, owner_phone=args.owner
                )
                print(f"{info['name']}: http://localhost:3000/t/{info['slug']}")
            await db.commit()
        elif args.command == "create":
            if args.teams < 2:
                raise SystemExit("--teams muss mindestens 2 sein.")
            played = args.played if args.played is not None else STATES[args.state][1]
            if played is not None and not 0.0 <= played <= 1.0:
                raise SystemExit("--played muss zwischen 0.0 und 1.0 liegen.")
            info = await create_tournament(
                db,
                teams=args.teams,
                tables=args.tables,
                played=played,
                state=None if args.played is not None else args.state,
                owner_phone=args.owner,
                name=args.name,
            )
            await db.commit()
            print(f"{info['name']}: {info['matches']} Matches, {info['rounds']} Runden, {info['played']} gespielt")
            print(f"http://localhost:3000/t/{info['slug']}")
        elif args.command == "delete":
            print(f"{await delete_dummy_tournaments(db)} Dummy-Turnier(e) gelöscht")
            await db.commit()
        else:
            token_value = await dummy_token(db, args.n)
            await db.commit()
            print(token_value)


if __name__ == "__main__":
    asyncio.run(main())
