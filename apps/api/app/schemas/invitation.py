from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.tournament_invitation import InvitationStatus
from app.schemas.tournament import TournamentPreview


class InvitationResponse(BaseModel):
    """An invitation as the invited person sees it: the tournament, who invited, and the answer so far."""
    id: UUID
    status: InvitationStatus
    created_at: datetime
    tournament: TournamentPreview
    invited_by_name: str | None = None  # a direct invitation
    link_label: str | None = None  # an invitation from a link ("WhatsApp")
    team_id: UUID | None = None  # the team it was accepted with
    team_name: str | None = None


class TournamentInvitationResponse(BaseModel):
    """An invitation as the organization sees it: who, from where, and how far."""
    id: UUID
    user_id: UUID
    user_name: str
    status: InvitationStatus
    invite_id: UUID | None = None  # from this link; None: invited directly
    invited_by_name: str | None = None
    team_name: str | None = None
    created_at: datetime


class InvitationCreate(BaseModel):
    """Invite a person directly."""
    user_id: UUID


class InvitationAccept(BaseModel):
    """Accept with this team."""
    team_id: UUID
