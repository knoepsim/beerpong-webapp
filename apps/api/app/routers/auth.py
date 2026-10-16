from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AppException, InvalidCredentialsError
from app.core.security import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    require_csrf_header,
    set_auth_cookies,
)
from app.schemas.auth import RefreshTokenRequest, SmsCodeRequest, SmsCodeVerify, TokenResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/request-code",
    status_code=204,
    summary="SMS-Code anfordern",
    description="Sendet einen 6-stelligen Verifizierungscode an die angegebene Telefonnummer.",
)
async def request_code(body: SmsCodeRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    await AuthService(db).request_sms_code(body.phone_number)


@router.post(
    "/verify",
    response_model=TokenResponse,
    responses={204: {"description": "Mit cookie_session: Sitzung als HttpOnly-Cookies, keine Tokens im Body"}},
    summary="SMS-Code verifizieren",
    description="Verifiziert den SMS-Code und gibt JWT Access- und Refresh-Tokens zurück. "
    "Mit `cookie_session` (Browser) setzt der Server stattdessen HttpOnly-Cookies und antwortet ohne Tokens. "
    "Erstellt automatisch einen neuen User, falls die Telefonnummer noch nicht registriert ist.",
)
async def verify_code(body: SmsCodeVerify, db: Annotated[AsyncSession, Depends(get_db)]):
    tokens = await AuthService(db).verify_code_and_authenticate(body.phone_number, body.code)
    if not body.cookie_session:
        return tokens
    response = Response(status_code=204)
    set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return response


@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses={204: {"description": "Ohne Body (Browser): neue Cookies, keine Tokens im Body"}},
    summary="Access-Token erneuern",
    description="Tauscht einen gültigen Refresh-Token gegen ein neues Token-Paar (Token Rotation). Ohne Body wird der "
    "Refresh-Cookie verwendet und die Sitzung per Cookie erneuert (jede Erneuerung verlängert die Sitzung).",
)
async def refresh_token(
    request: Request, db: Annotated[AsyncSession, Depends(get_db)], body: RefreshTokenRequest | None = None
):
    service = AuthService(db)
    if body is not None:
        return await service.refresh_access_token(body.refresh_token)

    require_csrf_header(request)
    raw = request.cookies.get(REFRESH_COOKIE)
    try:
        if raw is None:
            raise InvalidCredentialsError("No session")
        tokens = await service.refresh_access_token(raw)
    except AppException as exc:
        # a session that cannot be renewed is over: the browser must not keep its cookies
        response = JSONResponse(status_code=exc.status_code, content={"error_code": exc.error_code, "detail": exc.detail})
        clear_auth_cookies(response)
        return response
    response = Response(status_code=204)
    set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return response


@router.post(
    "/logout",
    status_code=204,
    summary="Abmelden",
    description="Beendet die Sitzung: der Refresh-Token wird widerrufen und die Cookies werden gelöscht.",
)
async def logout(request: Request, db: Annotated[AsyncSession, Depends(get_db)], body: RefreshTokenRequest | None = None):
    raw = body.refresh_token if body is not None else request.cookies.get(REFRESH_COOKIE)
    if body is None:
        require_csrf_header(request)
    if raw is not None:
        await AuthService(db).revoke_refresh_token(raw)
    response = Response(status_code=204)
    clear_auth_cookies(response)
    return response
