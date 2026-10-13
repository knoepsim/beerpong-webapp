from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.result import ResultType


class ResultCreate(BaseModel):
    """Request body for reporting a match result."""
    winner_team_id: UUID
    cups_left: int | None = None


class ResultResponse(BaseModel):
    """Single result event entry."""
    id: UUID
    match_id: UUID
    type: ResultType
    winner_team_id: UUID | None
    cups_left: int | None
    reported_by_user_id: UUID
    reported_by_username: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
