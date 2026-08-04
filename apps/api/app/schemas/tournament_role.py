from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.tournament_role import TournamentRoleType


class RoleAssignRequest(BaseModel):
    """Request body for assigning a role to a user."""
    user_id: UUID
    role: TournamentRoleType


class TournamentUserRoleResponse(BaseModel):
    """Response for a tournament role assignment."""
    id: UUID
    tournament_id: UUID
    user_id: UUID
    user_name: str | None = None
    role: TournamentRoleType
    assigned_at: datetime

    model_config = {"from_attributes": True}
