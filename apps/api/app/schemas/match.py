import enum
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class MatchStatus(str, enum.Enum):
    """Derived from the teams and the current result, not stored."""
    WAITING = "waiting"  # at least one team is not known yet
    READY = "ready"  # both teams are known, no result yet
    FINISHED = "finished"  # has a result


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
    # the table it is played at (also kept once it is finished); None while it has none
    table_id: UUID | None = None
    table_name: str | None = None
    # a ready match without a table: its place in the queue for the next free table (1 = next)
    queue_position: int | None = None
    created_at: datetime
    status: MatchStatus = MatchStatus.WAITING
    winner_team_id: UUID | None = None
    cups_left: int | None = None  # cups the winner had left

    model_config = {"from_attributes": True}


class BracketResponse(BaseModel):
    """Complete bracket tree for a tournament."""
    tournament_id: UUID
    total_rounds: int
    champion_team_id: UUID | None = None  # winner of the final, once it has a result
    matches: list[MatchResponse]
