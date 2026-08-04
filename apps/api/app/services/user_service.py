from fastapi import HTTPException
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.user import User
from app.schemas.user import UserUpdate
from app.services.auth_service import AuthService
from fastapi import Depends
from typing import Annotated
from app.core.database import get_db


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user(self, user_id: UUID) -> User:
        """Get a user by ID or raise NotFoundError."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User")
        return user


    from sqlalchemy.exc import IntegrityError
    from fastapi import HTTPException

    async def update_user(self, user: User, data: UserUpdate) -> User:
        """Update user profile fields."""
        if data.name is not None:
            user.name = data.name
        if data.email is not None:
            user.email = data.email

        try:
            await self.db.flush()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Diese E-Mail-Adresse ist bereits vergeben")

        return user


    async def request_phone_number_change(self, new_phone_number: str) -> None:
        """Checks if the new number is available and requests an SMS code."""
        result = await self.db.execute(select(User).where(User.phone_number == new_phone_number))
        if result.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="Diese Nummer ist bereits vergeben")

        await AuthService(self.db).request_sms_code(new_phone_number)


    async def verify_and_update_phone_number(self, user: User, new_phone_number: str, code: str) -> User:
        """Verifies the SMS code and updates the user's phone number."""
        result = await self.db.execute(select(User).where(User.phone_number == new_phone_number))
        if result.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="Diese Nummer ist bereits vergeben")

        await AuthService(self.db).verify_sms_code_only(new_phone_number, code)

        user.phone_number = new_phone_number
        await self.db.flush()
        return user


    from sqlalchemy import or_

    async def search_users(self, query: str) -> list[User]:
        """Search users by name or phone."""
        result = await self.db.execute(
            select(User).where(
                or_(
                    User.name.ilike(f"%{query}%"),
                    User.phone_number.ilike(f"%{query}%")
                )
            ).limit(10)
        )
        return list(result.scalars().all())




def get_user_service(db: Annotated[AsyncSession, Depends(get_db)]) -> UserService:
    return UserService(db)
