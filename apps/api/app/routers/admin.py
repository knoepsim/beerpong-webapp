from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_system_admin
from app.models.user import User
from app.models.tournament import Tournament
from app.schemas.user import UserResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get(
    "/users",
    response_model=list[UserResponse],
    summary="Alle Nutzer abfragen",
    description="Gibt eine Liste aller registrierten Nutzer zurück (Nur für System-Admins).",
)
async def list_all_users(
    admin_user: Annotated[User, Depends(get_current_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return users


@router.get(
    "/stats",
    summary="System-Statistiken",
    description="Gibt grobe Statistiken über das System zurück (Nur für System-Admins).",
)
async def get_system_stats(
    admin_user: Annotated[User, Depends(get_current_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    users_count = await db.execute(select(User))
    tournaments_count = await db.execute(select(Tournament))
    
    return {
        "total_users": len(users_count.scalars().all()),
        "total_tournaments": len(tournaments_count.scalars().all()),
    }
