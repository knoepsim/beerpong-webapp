from fastapi import HTTPException
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.user import User
from app.schemas.user import UserUpdate
from app.services import auth_service


async def get_user(db: AsyncSession, user_id: UUID) -> User:
    """Get a user by ID or raise NotFoundError."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError("User")
    return user


from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

async def update_user(db: AsyncSession, user: User, data: UserUpdate) -> User:
    """Update user profile fields."""
    if data.name is not None:
        user.name = data.name
    if data.email is not None:
        user.email = data.email
    
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Diese E-Mail-Adresse ist bereits vergeben")
    
    return user


async def request_phone_number_change(db: AsyncSession, new_phone_number: str) -> None:
    """Checks if the new number is available and requests an SMS code."""
    result = await db.execute(select(User).where(User.phone_number == new_phone_number))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Diese Nummer ist bereits vergeben")
    
    await auth_service.request_sms_code(db, new_phone_number)


async def verify_and_update_phone_number(db: AsyncSession, user: User, new_phone_number: str, code: str) -> User:
    """Verifies the SMS code and updates the user's phone number."""
    result = await db.execute(select(User).where(User.phone_number == new_phone_number))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Diese Nummer ist bereits vergeben")
        
    await auth_service.verify_sms_code_only(db, new_phone_number, code)
    
    user.phone_number = new_phone_number
    await db.flush()
    return user


from sqlalchemy import or_

async def search_users(db: AsyncSession, query: str) -> list[User]:
    """Search users by name or phone."""
    result = await db.execute(
        select(User).where(
            or_(
                User.name.ilike(f"%{query}%"),
                User.phone_number.ilike(f"%{query}%")
            )
        ).limit(10)
    )
    return list(result.scalars().all())

