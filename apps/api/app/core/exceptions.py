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
        super().__init__(401, "TOKEN_EXPIRED", "Token has expired")


class TokenRevokedError(AppException):
    def __init__(self):
        super().__init__(401, "TOKEN_REVOKED", "Token has been revoked")


# --- Not Found ---

class NotFoundError(AppException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(404, "NOT_FOUND", f"{resource} not found")


# --- Teams ---

class TeamFullError(AppException):
    def __init__(self):
        super().__init__(409, "TEAM_FULL", "Team has already reached its maximum size")


class AlreadyTeamMemberError(AppException):
    def __init__(self):
        super().__init__(409, "ALREADY_MEMBER", "User is already a member of this team")


# --- Invites ---

class InvalidInviteError(AppException):
    def __init__(self, detail: str = "Invite is invalid or has already been used"):
        super().__init__(400, "INVALID_INVITE", detail)


# --- Tournaments ---

class TournamentDeletedError(AppException):
    def __init__(self):
        super().__init__(410, "TOURNAMENT_DELETED", "Tournament has been deleted")


class TeamNotCompleteError(AppException):
    def __init__(self):
        super().__init__(400, "TEAM_NOT_COMPLETE", "Team must be complete before joining a tournament")


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


# --- Results ---

class ResultRequiresWinnerError(AppException):
    def __init__(self):
        super().__init__(400, "WINNER_REQUIRED", "A winner must be specified for created or modified results")


def register_exception_handlers(app: FastAPI) -> None:
    """Register the global AppException handler on the FastAPI app."""

    @app.exception_handler(AppException)
    async def app_exception_handler(_request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error_code": exc.error_code, "detail": exc.detail},
        )
