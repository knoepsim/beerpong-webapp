from pydantic import BaseModel


class SmsCodeRequest(BaseModel):
    """Request body for sending an SMS verification code."""
    phone_number: str


class SmsCodeVerify(BaseModel):
    """Request body for verifying an SMS code."""
    phone_number: str
    code: str


class TokenResponse(BaseModel):
    """Response containing JWT access and refresh tokens."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    """Request body for refreshing an access token."""
    refresh_token: str
