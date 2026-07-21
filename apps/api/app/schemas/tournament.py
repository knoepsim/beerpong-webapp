from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.tournament import TournamentMode, TournamentVisibility


class TournamentCreate(BaseModel):
    """Request body for creating a tournament."""
    name: str
    location: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    table_count: int = 1
    mode: TournamentMode = TournamentMode.SINGLE_ELIMINATION
    visibility: TournamentVisibility = TournamentVisibility.PRIVATE


class TournamentUpdate(BaseModel):
    """Request body for updating tournament details."""
    name: str | None = None
    location: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    table_count: int | None = None
    visibility: TournamentVisibility | None = None


class TournamentResponse(BaseModel):
    """Tournament details response."""
    id: UUID
    name: str
    location: str | None
    description: str | None
    start_time: datetime | None
    table_count: int
    mode: TournamentMode
    visibility: TournamentVisibility
    is_deleted: bool
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TournamentJoinRequest(BaseModel):
    """Request body for joining a tournament with a team."""
    team_id: UUID
