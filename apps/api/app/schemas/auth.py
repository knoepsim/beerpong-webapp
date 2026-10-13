import re
from pydantic import BaseModel, field_validator


def sanitize_phone_number(v: str) -> str:
    has_plus = v.startswith('+')
    digits = re.sub(r'\D', '', v)
    return f"+{digits}" if has_plus else digits


class SmsCodeRequest(BaseModel):
    """Request body for sending an SMS verification code."""
    phone_number: str

    @field_validator('phone_number')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return sanitize_phone_number(v)


class SmsCodeVerify(BaseModel):
    """Request body for verifying an SMS code."""
    phone_number: str
    code: str

    @field_validator('phone_number')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return sanitize_phone_number(v)


class TokenResponse(BaseModel):
    """Response containing JWT access and refresh tokens."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    """Request body for refreshing an access token."""
    refresh_token: str
