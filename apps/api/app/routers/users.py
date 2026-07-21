from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate
from app.services import user_service

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
    return await user_service.update_user(db, current_user, body)
