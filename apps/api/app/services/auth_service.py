import hashlib
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import InvalidCredentialsError, TokenRevokedError, TooManyRequestsError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_sms_code,
    hash_sms_code,
    verify_sms_code,
)
from app.core.sms import get_sms_service
from app.models.refresh_token import RefreshToken
from app.models.sms_verification import SmsVerification
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.core.database import DbSession


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def request_sms_code(self, phone_number: str) -> None:
        """Generate an SMS code, store its hash, and send it via the SMS service.

        Rate limited per phone number (cooldown between requests and a maximum per hour),
        which also covers the phone number change flow.
        """
        await self._enforce_request_limits(phone_number)

        # Only the newest code is valid: older ones must not give extra guesses
        await self.db.execute(
            update(SmsVerification)
            .where(SmsVerification.phone_number == phone_number, SmsVerification.used == False)  # noqa: E712
            .values(used=True)
        )

        code = generate_sms_code()
        code_hash = hash_sms_code(code)

        verification = SmsVerification(
            phone_number=phone_number,
            code_hash=code_hash,
            expires_at=datetime.now(UTC) + timedelta(minutes=settings.sms_code_expire_minutes),
        )
        self.db.add(verification)
        await self.db.flush()

        sms_service = get_sms_service()
        sms_service.send_code(phone_number, code)


    async def _count_requests_since(self, phone_number: str, since: datetime) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(SmsVerification)
            .where(SmsVerification.phone_number == phone_number, SmsVerification.created_at > since)
        )
        return result.scalar_one()


    async def _enforce_request_limits(self, phone_number: str) -> None:
        now = datetime.now(UTC)
        cooldown = timedelta(seconds=settings.sms_resend_cooldown_seconds)
        if await self._count_requests_since(phone_number, now - cooldown) > 0:
            raise TooManyRequestsError(
                f"Please wait {settings.sms_resend_cooldown_seconds} seconds before requesting a new code"
            )
        if await self._count_requests_since(phone_number, now - timedelta(hours=1)) >= settings.sms_max_requests_per_hour:
            raise TooManyRequestsError("Too many codes requested for this number, please try again later")


    async def verify_sms_code_only(self, phone_number: str, code: str) -> None:
        """Verifies an SMS code without issuing tokens. Raises InvalidCredentialsError if invalid."""
        result = await self.db.execute(
            select(SmsVerification)
            .where(
                SmsVerification.phone_number == phone_number,
                SmsVerification.used == False,  # noqa: E712
                SmsVerification.expires_at > datetime.now(UTC),
            )
            .order_by(SmsVerification.created_at.desc())
            .limit(1)
        )
        verification = result.scalar_one_or_none()

        if verification is None:
            raise InvalidCredentialsError("Invalid or expired verification code")

        if not verify_sms_code(code, verification.code_hash):
            verification.failed_attempts += 1
            if verification.failed_attempts >= settings.sms_max_verify_attempts:
                verification.used = True  # burn the code, a new one has to be requested
            # The request fails, so get_db would roll back: persist the attempt counter explicitly
            await self.db.commit()
            raise InvalidCredentialsError("Invalid or expired verification code")

        # Mark code as used
        verification.used = True


    async def verify_code_and_authenticate(self, phone_number: str, code: str
    ) -> TokenResponse:
        """Verify SMS code, create user if needed, and return JWT tokens."""
        await self.verify_sms_code_only(phone_number, code)

        # Find or create user
        user_result = await self.db.execute(select(User).where(User.phone_number == phone_number))
        user = user_result.scalar_one_or_none()

        if user is None:
            # First-time registration: create user with phone number as temporary name
            user = User(phone_number=phone_number, name=phone_number)
            self.db.add(user)
            await self.db.flush()

        # Admin Bootstrapping
        super_admin_phones = [p.strip() for p in settings.super_admin_phones.split(",") if p.strip()]
        if phone_number in super_admin_phones and not user.is_system_admin:
            user.is_system_admin = True
            await self.db.flush()

        # Create tokens
        access_token = create_access_token(user.id)
        raw_refresh, refresh_hash = create_refresh_token()

        # Store refresh token server-side
        refresh_entry = RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
        )
        self.db.add(refresh_entry)

        return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


    async def refresh_access_token(self, raw_refresh_token: str) -> TokenResponse:
        """Validate a refresh token and issue new tokens."""
        token_hash = hashlib.sha256(raw_refresh_token.encode()).hexdigest()

        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.expires_at > datetime.now(UTC),
            )
        )
        stored_token = result.scalar_one_or_none()

        if stored_token is None:
            raise InvalidCredentialsError("Invalid or expired refresh token")

        if stored_token.revoked:
            raise TokenRevokedError()

        # Revoke old refresh token (rotation)
        stored_token.revoked = True

        # Issue new token pair
        access_token = create_access_token(stored_token.user_id)
        new_raw_refresh, new_refresh_hash = create_refresh_token()

        new_refresh_entry = RefreshToken(
            user_id=stored_token.user_id,
            token_hash=new_refresh_hash,
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
        )
        self.db.add(new_refresh_entry)

        return TokenResponse(access_token=access_token, refresh_token=new_raw_refresh)


    async def revoke_refresh_token(self, raw_refresh_token: str) -> None:
        """End one session: its refresh token cannot be used any more (unknown tokens are ignored)."""
        token_hash = hashlib.sha256(raw_refresh_token.encode()).hexdigest()
        await self.db.execute(update(RefreshToken).where(RefreshToken.token_hash == token_hash).values(revoked=True))

    async def revoke_all_user_tokens(self, user_id: UUID) -> None:
        """Revoke all refresh tokens for a user (e.g. on phone number change)."""
        await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked == False)  # noqa: E712
            .values(revoked=True)
        )



def get_auth_service(db: DbSession) -> AuthService:
    return AuthService(db)
