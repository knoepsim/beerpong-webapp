import enum
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.tournament import TournamentMode


class MatchStatus(str, enum.Enum):
    """Derived from the teams, the station, the start and the current result, not stored."""
    WAITING = "waiting"  # at least one team is not known yet (still in another match)
    QUEUED = "queued"  # both teams are known, waiting for a free station
    READY = "ready"  # at its station, not started yet
    LIVE = "live"  # started at its station
    FINISHED = "finished"  # has a result (can be reported in any state with both teams)


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
    # group stage: its group (1 = A); knock-out after groups: where its teams come from ("A1") until it starts
    group: int | None = Field(default=None, validation_alias="group_number")
    source_a: str | None = None
    source_b: str | None = None
    # the station it is played at (also kept once it is finished); None while it has none
    station_id: UUID | None = None
    station_name: str | None = None
    # a ready match without a station: its place in the queue for the next free station (1 = next)
    queue_position: int | None = None
    # a match still waiting for a team whose station is already certain (towards the end, when nothing queues)
    upcoming_station_id: UUID | None = None
    upcoming_station_name: str | None = None
    # since when it is at its station (ready or live): a long wait without a start shows teams that do not come
    on_station_at: datetime | None = None
    started_at: datetime | None = None
    created_at: datetime
    status: MatchStatus = MatchStatus.WAITING
    winner_team_id: UUID | None = None
    # the score of the current result (what it counts is up to the game), None before the result
    score_a: int | None = None
    score_b: int | None = None

    model_config = {"from_attributes": True}


class StandingResponse(BaseModel):
    """A row of the table of a tournament where everybody plays everybody."""
    team_id: UUID
    rank: int
    played: int
    won: int
    drawn: int
    lost: int
    score_for: int
    score_against: int
    points: int


class GroupResponse(BaseModel):
    """A group of the group stage and its table."""
    group: int
    standings: list[StandingResponse]


class BracketResponse(BaseModel):
    """All matches of a tournament: a tree (knock-out) or match days (everybody against everybody)."""
    tournament_id: UUID
    mode: TournamentMode
    # knock-out: rounds of the tree; everybody against everybody: match days
    total_rounds: int
    # once it is decided: the winner of the final, or the first of the table when all is played
    champion_team_id: UUID | None = None
    matches: list[MatchResponse]
    # the table, only where everybody plays everybody
    standings: list[StandingResponse] | None = None
    # group stage and knock-out: the groups with their tables (the matches with a group belong to them); the knock-out
    # is the tree of the matches without a group, its teams come in when the organization starts it
    groups: list[GroupResponse] | None = None
    knockout_started: bool = False
