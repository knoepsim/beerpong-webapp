from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.result import ResultType


class ResultCreate(BaseModel):
    """Request body for reporting a match result."""
    # None for a draw (only where the game and the mode have draws, see app/games.py)
    winner_team_id: UUID | None = None
    # the score of team a and team b of the match; the game decides what is possible (app/games.py)
    score_a: int = Field(ge=0)
    score_b: int = Field(ge=0)


class ResultResponse(BaseModel):
    """Single result event entry."""
    id: UUID
    match_id: UUID
    type: ResultType
    winner_team_id: UUID | None
    score_a: int | None
    score_b: int | None
    reported_by_user_id: UUID
    reported_by_username: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
