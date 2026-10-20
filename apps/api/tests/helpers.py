"""Shared helpers for service-level tests."""
import uuid
from datetime import UTC, datetime

from app.models.team import Team
from app.models.tournament import Game, Tournament, TournamentMode, TournamentTeam, TournamentVisibility
from app.services.bracket_service import BracketService

# what every new tournament has to say: which game and which mode (the API has no default for them)
PLAYS = {"game": "beerpong", "mode": "single_elimination"}


def won(match, winner_id, cups: int = 3) -> dict:
    """A beer pong result as the API takes it: the winner kept `cups`, the loser none. `match` as dict or object."""
    team_a = match["team_a_id"] if isinstance(match, dict) else match.team_a_id
    score_a = cups if winner_id == team_a else 0
    return {"winner_team_id": winner_id, "score_a": score_a, "score_b": cups - score_a}


async def generate_started_tournament(db, n: int):
    """A started tournament with n teams and its bracket. Returns (service, tournament, team ids)."""
    tournament = Tournament(
        name="x",
        game=Game.BEERPONG,
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
