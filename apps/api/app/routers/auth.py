from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
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
    summary="SMS-Code verifizieren",
    description="Verifiziert den SMS-Code und gibt JWT Access- und Refresh-Tokens zurück. "
    "Erstellt automatisch einen neuen User, falls die Telefonnummer noch nicht registriert ist.",
)
async def verify_code(body: SmsCodeVerify, db: Annotated[AsyncSession, Depends(get_db)]):
    return await AuthService(db).verify_code_and_authenticate(body.phone_number, body.code)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Access-Token erneuern",
    description="Tauscht einen gültigen Refresh-Token gegen ein neues Token-Paar (Token Rotation).",
)
async def refresh_token(body: RefreshTokenRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    return await AuthService(db).refresh_access_token(body.refresh_token)
