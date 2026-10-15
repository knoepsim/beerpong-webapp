from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.tournament import JoinPolicy, TournamentMode, TournamentPhase, TournamentVisibility
from app.models.tournament_role import TournamentRoleType
from app.schemas.team import TeamResponse


class TournamentCreate(BaseModel):
    """Request body for creating a tournament."""
    name: str = Field(min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    start_time: datetime
    registration_end_time: datetime | None = None
    registration_auto_close: bool = False
    checkin_enabled: bool = False
    checkin_start_time: datetime | None = None
    checkin_auto_open: bool = False
    table_count: int = Field(default=1, ge=1, le=100)
    mode: TournamentMode = TournamentMode.SINGLE_ELIMINATION
    visibility: TournamentVisibility = TournamentVisibility.PUBLIC
    join_policy: JoinPolicy = JoinPolicy.OPEN


class TournamentUpdate(BaseModel):
    """Request body for updating tournament details."""
    name: str | None = Field(default=None, min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    start_time: datetime | None = None
    slug: str | None = Field(default=None, max_length=40)
    registration_end_time: datetime | None = None
    registration_auto_close: bool | None = None
    checkin_enabled: bool | None = None
    checkin_start_time: datetime | None = None
    checkin_auto_open: bool | None = None
    table_count: int | None = Field(default=None, ge=1, le=100)
    visibility: TournamentVisibility | None = None
    join_policy: JoinPolicy | None = None


class TournamentResponse(BaseModel):
    """Tournament details response."""
    id: UUID
    slug: str
    name: str
    location: str | None
    description: str | None
    start_time: datetime | None
    registration_end_time: datetime | None
    registration_auto_close: bool
    checkin_enabled: bool
    checkin_start_time: datetime | None
    checkin_auto_open: bool
    started_at: datetime | None
    finished_at: datetime | None
    phase: TournamentPhase
    registration_open: bool
    checkin_open: bool
    table_count: int
    mode: TournamentMode
    visibility: TournamentVisibility
    join_policy: JoinPolicy
    is_deleted: bool
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TournamentStartResponse(BaseModel):
    """Outcome of starting a tournament."""
    team_count: int
    removed_team_ids: list[UUID] = []


class TournamentJoinRequest(BaseModel):
    """Request body for joining a tournament with a team."""
    team_id: UUID
    invite_token: str | None = None


class InviteCreate(BaseModel):
    """Request body for a new invitation link."""
    label: str | None = Field(default=None, max_length=60)


class InviteResponse(BaseModel):
    """An invitation link of a tournament with the number of teams that joined through it."""
    id: UUID
    token: str
    label: str | None
    created_at: datetime
    uses: int


class TournamentPreview(BaseModel):
    """What a stranger may see of a tournament before joining: enough to decide, nothing about the participants."""
    tournament_id: UUID
    slug: str
    name: str
    location: str | None
    start_time: datetime | None
    registration_open: bool
    join_policy: JoinPolicy


class ParticipatingTournament(BaseModel):
    tournament: TournamentResponse
    team: TeamResponse

    model_config = {"from_attributes": True}


class ManagedTournament(BaseModel):
    tournament: TournamentResponse
    role: TournamentRoleType

    model_config = {"from_attributes": True}


class MyTournamentsResponse(BaseModel):
    participating: list[ParticipatingTournament]
    managing: list[ManagedTournament]
