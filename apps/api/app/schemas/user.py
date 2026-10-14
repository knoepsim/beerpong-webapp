from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator

from app.core.phone import normalize_german_mobile


class UserResponse(BaseModel):
    """Public user profile response."""
    id: UUID
    phone_number: str
    email: str | None
    name: str
    is_system_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserPublic(BaseModel):
    """Minimal user info for other users (search results): no phone number, no e-mail."""
    id: UUID
    name: str

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """Request body for updating user profile."""
    name: str | None = None
    email: EmailStr | None = None


class PhoneNumberChangeRequest(BaseModel):
    """Request body for initiating a phone number change."""
    new_phone_number: str

    @field_validator('new_phone_number')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return normalize_german_mobile(v)


class PhoneNumberChangeVerify(BaseModel):
    """Request body for verifying a phone number change."""
    new_phone_number: str
    code: str

    @field_validator('new_phone_number')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return normalize_german_mobile(v)
