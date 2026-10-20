from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Base exception for all application-specific errors."""

    def __init__(self, status_code: int, error_code: str, detail: str) -> None:
        self.status_code = status_code
        self.error_code = error_code
        self.detail = detail
        super().__init__(detail)


# --- Auth ---

class InvalidCredentialsError(AppException):
    def __init__(self, detail: str = "Invalid credentials"):
        super().__init__(401, "INVALID_CREDENTIALS", detail)


class TokenExpiredError(AppException):
    def __init__(self):
        super().__init__(401, "TOKEN_EXPIRED", "Deine Anmeldung ist abgelaufen. Melde dich neu an.")


class TokenRevokedError(AppException):
    def __init__(self):
        super().__init__(401, "TOKEN_REVOKED", "Deine Anmeldung ist nicht mehr gültig. Melde dich neu an.")


# --- Not Found ---

class NotFoundError(AppException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(404, "NOT_FOUND", f"{resource} nicht gefunden.")


# --- Teams ---

class TeamFullError(AppException):
    def __init__(self):
        super().__init__(409, "TEAM_FULL", "Das Team ist schon voll.")


class AlreadyTeamMemberError(AppException):
    def __init__(self):
        super().__init__(409, "ALREADY_MEMBER", "Du bist schon in diesem Team.")


# --- Invites ---

class InvalidInviteError(AppException):
    def __init__(self, detail: str = "Invite is invalid or has already been used"):
        super().__init__(400, "INVALID_INVITE", detail)


class TooManyRequestsError(AppException):
    def __init__(self, detail: str = "Too many requests, please try again later"):
        super().__init__(429, "TOO_MANY_REQUESTS", detail)


# --- Tournaments ---

class TournamentDeletedError(AppException):
    def __init__(self):
        super().__init__(410, "TOURNAMENT_DELETED", "Dieses Turnier wurde gelöscht.")


class TeamNotCompleteError(AppException):
    def __init__(self):
        super().__init__(400, "TEAM_NOT_COMPLETE", "Dein Team braucht erst alle Spieler, bevor es einem Turnier beitreten kann.")


class PlayerAlreadyInTournamentError(AppException):
    def __init__(self):
        super().__init__(
            409,
            "PLAYER_ALREADY_IN_TOURNAMENT",
            "A member of this team is already registered with another team in this tournament",
        )


# --- Roles ---

class InsufficientRoleError(AppException):
    def __init__(self, detail: str = "Insufficient permissions for this action"):
        super().__init__(403, "INSUFFICIENT_ROLE", detail)


class TournamentAlreadyStartedError(AppException):
    def __init__(self):
        super().__init__(409, "TOURNAMENT_ALREADY_STARTED", "Das geht nach dem Turnierstart nicht mehr.")


class TournamentNotStartedError(AppException):
    def __init__(self):
        super().__init__(409, "TOURNAMENT_NOT_STARTED", "Das Turnier hat noch nicht begonnen.")


class RegistrationClosedError(AppException):
    def __init__(self):
        super().__init__(409, "REGISTRATION_CLOSED", "Die Anmeldung für dieses Turnier ist geschlossen.")


class CheckinDisabledError(AppException):
    def __init__(self):
        super().__init__(409, "CHECKIN_DISABLED", "Für dieses Turnier gibt es keinen Check-in.")


class CheckinNotOpenError(AppException):
    def __init__(self):
        super().__init__(409, "CHECKIN_NOT_OPEN", "Der Check-in hat noch nicht begonnen.")


class NotEnoughTeamsError(AppException):
    def __init__(self, checkin_enabled: bool):
        detail = (
            "Es müssen mindestens 2 Teams eingecheckt sein, um das Turnier zu starten."
            if checkin_enabled
            else "Es müssen mindestens 2 Teams angemeldet sein, um das Turnier zu starten."
        )
        super().__init__(409, "NOT_ENOUGH_TEAMS", detail)


class InvalidSlugError(AppException):
    def __init__(self, detail: str):
        super().__init__(422, "INVALID_SLUG", detail)


class SlugTakenError(AppException):
    def __init__(self):
        super().__init__(409, "SLUG_TAKEN", "Diese Adresse ist schon vergeben.")


class AlreadyParticipantError(AppException):
    def __init__(self):
        super().__init__(409, "ALREADY_PARTICIPANT", "Diese Person spielt schon in diesem Turnier mit.")


class InvitationAnsweredError(AppException):
    def __init__(self):
        super().__init__(409, "INVITATION_ANSWERED", "Diese Einladung ist schon beantwortet. Lade die Seite neu.")


class InviteRequiredError(AppException):
    def __init__(self):
        super().__init__(403, "INVITE_REQUIRED", "Zum Beitreten brauchst du einen Einladungslink.")


class InvalidScheduleError(AppException):
    def __init__(self, detail: str):
        super().__init__(422, "INVALID_SCHEDULE", detail)


# --- Results ---

class MatchNotReadyError(AppException):
    def __init__(self):
        super().__init__(409, "MATCH_NOT_READY", "Für dieses Spiel stehen noch nicht beide Teams fest.")


class InvalidWinnerError(AppException):
    def __init__(self):
        super().__init__(400, "INVALID_WINNER", "Der Sieger muss eines der beiden Teams dieses Spiels sein.")


class InvalidScoreError(AppException):
    """The score is not possible in the game of the tournament (see app/games.py)."""

    def __init__(self, detail: str):
        super().__init__(400, "INVALID_SCORE", detail)


class ResultConflictError(AppException):
    def __init__(self, detail: str):
        super().__init__(409, "RESULT_CONFLICT", detail)


class TeamInTournamentError(AppException):
    def __init__(self, detail: str):
        super().__init__(409, "TEAM_IN_TOURNAMENT", detail)


class MatchNotAtTableError(AppException):
    def __init__(self):
        super().__init__(409, "MATCH_NOT_AT_TABLE", "Das Spiel hat noch keinen Tisch und kann noch nicht starten.")


class InvalidTableNameError(AppException):
    def __init__(self, detail: str):
        super().__init__(422, "INVALID_TABLE_NAME", detail)


class TableNameTakenError(AppException):
    def __init__(self):
        super().__init__(409, "TABLE_NAME_TAKEN", "Einen Tisch mit diesem Namen gibt es schon.")


class LastTableError(AppException):
    def __init__(self):
        super().__init__(409, "LAST_TABLE", "Ein Turnier braucht mindestens einen Tisch.")


class TooManyTablesError(AppException):
    def __init__(self, maximum: int):
        super().__init__(409, "TOO_MANY_TABLES", f"Ein Turnier kann höchstens {maximum} Tische haben.")


def register_exception_handlers(app: FastAPI) -> None:
    """Register the global AppException handler on the FastAPI app."""

    @app.exception_handler(AppException)
    async def app_exception_handler(_request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error_code": exc.error_code, "detail": exc.detail},
        )
