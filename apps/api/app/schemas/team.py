from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TeamCreate(BaseModel):
    """Request body for creating a team."""
    name: str


class TeamUpdate(BaseModel):
    """Request body for updating a team."""
    name: str

class TeamMemberResponse(BaseModel):
    """A team member entry."""
    user_id: UUID
    name: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class TeamDeleteBlocker(BaseModel):
    """A tournament that keeps a team from being deleted (it plays in it or is registered for it)."""
    tournament_name: str
    tournament_slug: str
    running: bool  # False: registered, the tournament has not started yet
    registration_open: bool  # the team can still leave it


class TeamResponse(BaseModel):
    """Team details response."""
    id: UUID
    name: str
    max_size: int
    members: list[TeamMemberResponse] = []
    is_complete: bool = False
    # empty: the team can be deleted (a team can always be renamed; started tournaments keep the old name)
    delete_blockers: list[TeamDeleteBlocker] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class TournamentTeamResponse(TeamResponse):
    """Team details response with tournament specific data like check-in status."""
    is_checked_in: bool = False

    model_config = {"from_attributes": True}


class TeamInviteResponse(BaseModel):
    """Response containing the invite link token."""
    id: UUID
    team_id: UUID
    token: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamInviteDetailsResponse(BaseModel):
    """Response containing details about an invite."""
    team_id: UUID
    team_name: str
    inviter_name: str

    model_config = {"from_attributes": True}
