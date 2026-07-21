from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class MatchResponse(BaseModel):
    """Single match in a tournament bracket."""
    id: UUID
    tournament_id: UUID
    round: int
    position: int
    team_a_id: UUID | None
    team_b_id: UUID | None
    next_match_id: UUID | None
    next_match_slot: str | None
    table_number: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BracketResponse(BaseModel):
    """Complete bracket tree for a tournament."""
    tournament_id: UUID
    total_rounds: int
    matches: list[MatchResponse]
