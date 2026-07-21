"""Database models — import all models here for Alembic auto-discovery."""

from app.models.match import Match
from app.models.refresh_token import RefreshToken
from app.models.result import Result, ResultType
from app.models.sms_verification import SmsVerification
from app.models.team import Team, TeamMember
from app.models.team_invite import TeamInvite
from app.models.tournament import Tournament, TournamentMode, TournamentTeam, TournamentVisibility
from app.models.tournament_role import TournamentRoleType, TournamentUserRole
from app.models.user import User

__all__ = [
    "Match",
    "RefreshToken",
    "Result",
    "ResultType",
    "SmsVerification",
    "Team",
    "TeamInvite",
    "TeamMember",
    "Tournament",
    "TournamentMode",
    "TournamentTeam",
    "TournamentRoleType",
    "TournamentUserRole",
    "TournamentVisibility",
    "User",
]
