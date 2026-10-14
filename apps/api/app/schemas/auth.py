from pydantic import BaseModel, field_validator

from app.core.phone import normalize_german_mobile


class SmsCodeRequest(BaseModel):
    """Request body for sending an SMS verification code."""
    phone_number: str

    @field_validator('phone_number')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return normalize_german_mobile(v)


class SmsCodeVerify(BaseModel):
    """Request body for verifying an SMS code."""
    phone_number: str
    code: str

    @field_validator('phone_number')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return normalize_german_mobile(v)


class TokenResponse(BaseModel):
    """Response containing JWT access and refresh tokens."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    """Request body for refreshing an access token."""
    refresh_token: str
