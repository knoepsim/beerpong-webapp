from fastapi import HTTPException
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.phone import normalize_german_mobile
from app.models.user import User
from app.schemas.user import UserUpdate
from app.services.auth_service import AuthService
from app.core.database import DbSession


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
        # The phone number is the login identity: sessions of the old number must not survive
        await AuthService(self.db).revoke_all_user_tokens(user.id)
        await self.db.flush()
        return user


    async def search_users(self, query: str) -> list[User]:
        """Search users by name (substring) or by a complete German mobile number (exact).

        Partial phone numbers are deliberately not matched, otherwise the endpoint could be
        used to enumerate phone numbers.
        """
        try:
            condition = User.phone_number == normalize_german_mobile(query)
        except ValueError:
            escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            condition = User.name.ilike(f"%{escaped}%", escape="\\")
        result = await self.db.execute(select(User).where(condition).order_by(User.name).limit(10))
        return list(result.scalars().all())




def get_user_service(db: DbSession) -> UserService:
    return UserService(db)
