"""Shared helpers for service-level tests."""
import uuid
from datetime import UTC, datetime

from app.models.team import Team
from app.models.tournament import Tournament, TournamentMode, TournamentTeam, TournamentVisibility
from app.services.bracket_service import BracketService


async def generate_started_tournament(db, n: int):
    """A started tournament with n teams and its bracket. Returns (service, tournament, team ids)."""
    tournament = Tournament(
        name="x",
        mode=TournamentMode.SINGLE_ELIMINATION,
        visibility=TournamentVisibility.PRIVATE,
        created_by_id=uuid.uuid4(),
    )
    db.add(tournament)
    await db.flush()
    teams = []
    for i in range(n):
        team = Team(name=f"T{i}")
        db.add(team)
        await db.flush()
        db.add(TournamentTeam(tournament_id=tournament.id, team_id=team.id))
        teams.append(team.id)
    await db.flush()
    service = BracketService(db)
    await service.generate_bracket(tournament.id, teams)
    tournament.started_at = datetime.now(UTC)
    await db.flush()
    return service, tournament, teams
