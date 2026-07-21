import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

security_scheme = HTTPBearer()


def create_access_token(user_id: UUID) -> str:
    """Create a short-lived JWT access token."""
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes),
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def create_refresh_token() -> tuple[str, str]:
    """Create a long-lived refresh token. Returns (raw_token, token_hash)."""
    raw_token = secrets.token_urlsafe(64)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    return raw_token, token_hash


def verify_access_token(token: str) -> UUID:
    """Verify a JWT access token and return the user ID."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        return UUID(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


def hash_sms_code(code: str) -> str:
    """Hash an SMS verification code using SHA-256."""
    return hashlib.sha256(code.encode()).hexdigest()


def verify_sms_code(code: str, code_hash: str) -> bool:
    """Verify an SMS code against its hash."""
    return hashlib.sha256(code.encode()).hexdigest() == code_hash


def generate_sms_code() -> str:
    """Generate a random numeric SMS verification code."""
    return "".join(secrets.choice("0123456789") for _ in range(settings.sms_code_length))


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """FastAPI dependency: extract and verify JWT, return User object."""
    from app.models.user import User

    user_id = verify_access_token(credentials.credentials)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user
