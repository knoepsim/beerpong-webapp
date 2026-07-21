from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UserResponse(BaseModel):
    """Public user profile response."""
    id: UUID
    phone_number: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """Request body for updating user profile."""
    name: str | None = None


class PhoneNumberChangeRequest(BaseModel):
    """Request body for initiating a phone number change."""
    new_phone_number: str


class PhoneNumberChangeVerify(BaseModel):
    """Request body for verifying a phone number change."""
    new_phone_number: str
    code: str
