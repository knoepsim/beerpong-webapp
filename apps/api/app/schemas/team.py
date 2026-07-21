from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TeamCreate(BaseModel):
    """Request body for creating a team."""
    name: str


class TeamMemberResponse(BaseModel):
    """A team member entry."""
    user_id: UUID
    joined_at: datetime

    model_config = {"from_attributes": True}


class TeamResponse(BaseModel):
    """Team details response."""
    id: UUID
    name: str
    max_size: int
    members: list[TeamMemberResponse] = []
    is_complete: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamInviteResponse(BaseModel):
    """Response containing the invite link token."""
    id: UUID
    team_id: UUID
    token: str
    created_at: datetime

    model_config = {"from_attributes": True}
