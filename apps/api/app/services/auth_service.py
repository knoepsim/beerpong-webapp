import hashlib
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import InvalidCredentialsError, TokenRevokedError
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


async def request_sms_code(db: AsyncSession, phone_number: str) -> None:
    """Generate an SMS code, store its hash, and send it via the SMS service."""
    code = generate_sms_code()
    code_hash = hash_sms_code(code)

    verification = SmsVerification(
        phone_number=phone_number,
        code_hash=code_hash,
        expires_at=datetime.now(UTC) + timedelta(minutes=settings.sms_code_expire_minutes),
    )
    db.add(verification)
    await db.flush()

    sms_service = get_sms_service()
    sms_service.send_code(phone_number, code)


async def verify_code_and_authenticate(
    db: AsyncSession, phone_number: str, code: str
) -> TokenResponse:
    """Verify SMS code, create user if needed, and return JWT tokens."""
    # Find the latest unused, non-expired verification for this number
    result = await db.execute(
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

    if verification is None or not verify_sms_code(code, verification.code_hash):
        raise InvalidCredentialsError("Invalid or expired verification code")

    # Mark code as used
    verification.used = True

    # Find or create user
    user_result = await db.execute(select(User).where(User.phone_number == phone_number))
    user = user_result.scalar_one_or_none()

    if user is None:
        # First-time registration: create user with phone number as temporary name
        user = User(phone_number=phone_number, name=phone_number)
        db.add(user)
        await db.flush()

    # Create tokens
    access_token = create_access_token(user.id)
    raw_refresh, refresh_hash = create_refresh_token()

    # Store refresh token server-side
    refresh_entry = RefreshToken(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(refresh_entry)

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


async def refresh_access_token(db: AsyncSession, raw_refresh_token: str) -> TokenResponse:
    """Validate a refresh token and issue new tokens."""
    token_hash = hashlib.sha256(raw_refresh_token.encode()).hexdigest()

    result = await db.execute(
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
    db.add(new_refresh_entry)

    return TokenResponse(access_token=access_token, refresh_token=new_raw_refresh)


async def revoke_all_user_tokens(db: AsyncSession, user_id: UUID) -> None:
    """Revoke all refresh tokens for a user (e.g. on phone number change)."""
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked == False)  # noqa: E712
        .values(revoked=True)
    )
