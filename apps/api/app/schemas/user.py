import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


def sanitize_phone_number(v: str) -> str:
    has_plus = v.startswith('+')
    digits = re.sub(r'\D', '', v)
    return f"+{digits}" if has_plus else digits


class UserResponse(BaseModel):
    """Public user profile response."""
    id: UUID
    phone_number: str
    email: str | None
    name: str
    is_system_admin: bool
    created_at: datetime

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
        return sanitize_phone_number(v)


class PhoneNumberChangeVerify(BaseModel):
    """Request body for verifying a phone number change."""
    new_phone_number: str
    code: str

    @field_validator('new_phone_number')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return sanitize_phone_number(v)
