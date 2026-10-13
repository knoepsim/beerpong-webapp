from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate, PhoneNumberChangeRequest, PhoneNumberChangeVerify
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Eigenes Profil abrufen",
    description="Gibt das Profil des authentifizierten Users zurück.",
)
async def get_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Profil aktualisieren",
    description="Aktualisiert den Namen des authentifizierten Users.",
)
async def update_me(
    body: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await UserService(db).update_user(current_user, body)


@router.post(
    "/me/phone/request",
    status_code=204,
    summary="Telefonnummer-Änderung anfordern",
    description="Sendet einen SMS-Code an die neue Telefonnummer, sofern sie nicht belegt ist.",
)
async def request_phone_change(
    body: PhoneNumberChangeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await UserService(db).request_phone_number_change(body.new_phone_number)


@router.post(
    "/me/phone/verify",
    response_model=UserResponse,
    summary="Telefonnummer-Änderung verifizieren",
    description="Verifiziert den SMS-Code und speichert die neue Telefonnummer.",
)
async def verify_phone_change(
    body: PhoneNumberChangeVerify,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await UserService(db).verify_and_update_phone_number(current_user, body.new_phone_number, body.code)


@router.get(
    "/search",
    response_model=list[UserResponse],
    summary="Nutzer suchen",
    description="Sucht Nutzer anhand des Namens (case-insensitive) für die Zuweisung von Rollen.",
)
async def search_users(
    query: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if len(query) < 2:
        return []
    return await UserService(db).search_users(query)
