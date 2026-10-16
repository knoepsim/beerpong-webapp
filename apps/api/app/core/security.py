import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

optional_security_scheme = HTTPBearer(auto_error=False)


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
    return hmac.compare_digest(hashlib.sha256(code.encode()).hexdigest(), code_hash)


def generate_sms_code() -> str:
    """Generate a random numeric SMS verification code."""
    if settings.sms_backend == "dummy":
        return "123456"
    return "".join(str(secrets.randbelow(10)) for _ in range(settings.sms_code_length))


ACCESS_COOKIE = "beerpong_access_token"
REFRESH_COOKIE = "beerpong_refresh_token"
# A browser sends this header only from our own pages (a form on another site cannot set it, a script on another
# site needs a CORS preflight we refuse): together with SameSite=Lax it keeps other sites from acting for a user.
CSRF_HEADER = "X-Requested-With"
_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Start a browser session: both tokens as HttpOnly cookies, out of reach of scripts on the page.

    The access cookie outlives the (short) access token it holds: an expired token is renewed with the refresh cookie,
    but the page proxy still sees that a session exists."""
    lifetime = settings.refresh_token_expire_days * 24 * 3600
    common = {"httponly": True, "secure": settings.cookies_secure, "samesite": "lax", "max_age": lifetime}
    response.set_cookie(ACCESS_COOKIE, access_token, path="/", **common)
    response.set_cookie(REFRESH_COOKIE, refresh_token, path=settings.refresh_cookie_path, **common)


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path=settings.refresh_cookie_path)


def require_csrf_header(request: Request) -> None:
    """Writing requests that rely on a cookie must come from our own pages."""
    if request.method not in _SAFE_METHODS and CSRF_HEADER not in request.headers:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing request header")


def _bearer_or_cookie(request: Request, credentials: HTTPAuthorizationCredentials | None) -> str | None:
    """The access token of a request: an Authorization header (scripts, tests) wins over the session cookie."""
    if credentials is not None:
        return credentials.credentials
    token = request.cookies.get(ACCESS_COOKIE)
    if token is not None:
        require_csrf_header(request)
    return token


async def _user_for_token(token: str, db: AsyncSession):
    from app.models.user import User

    user_id = verify_access_token(token)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """FastAPI dependency: the logged-in user from the Authorization header or the session cookie."""
    token = _bearer_or_cookie(request, credentials)
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return await _user_for_token(token, db)


async def user_from_request(request: Request, db: AsyncSession):
    """The user behind a request, None for no or an invalid token (a stranger)."""
    credentials = await optional_security_scheme(request)
    token = credentials.credentials if credentials else request.cookies.get(ACCESS_COOKIE)
    if token is None:
        return None
    try:
        return await _user_for_token(token, db)
    except HTTPException:
        return None


async def get_optional_user(request: Request, db: AsyncSession = Depends(get_db)):
    """Like get_current_user, but for pages anybody may open: no (or an invalid) token means a stranger, not an error."""
    return await user_from_request(request, db)


async def get_current_system_admin(
    current_user=Depends(get_current_user),
):
    """FastAPI dependency: ensure the current user is a system admin."""
    if not current_user.is_system_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires system admin privileges",
        )
    return current_user
