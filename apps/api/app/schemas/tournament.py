from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.tournament import Game, JoinPolicy, TournamentMode, TournamentPhase, TournamentVisibility
from app.models.tournament_role import TournamentRoleType
from app.schemas.match import MatchResponse
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
    station_count: int = Field(default=1, ge=1, le=100)
    # group stage and knock-out only: how many groups, how many of each go on
    group_count: int | None = Field(default=None, ge=1, le=26)
    advance_per_group: int | None = Field(default=None, ge=1, le=16)
    # no default: what is played and how is a decision of the organizer
    game: Game
    mode: TournamentMode
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
    game: Game | None = None
    mode: TournamentMode | None = None
    visibility: TournamentVisibility | None = None
    join_policy: JoinPolicy | None = None
    group_count: int | None = Field(default=None, ge=1, le=26)
    advance_per_group: int | None = Field(default=None, ge=1, le=16)


class TournamentResponse(BaseModel):
    """Tournament details response."""
    id: UUID
    slug: str
    revision: int
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
    game: Game
    mode: TournamentMode
    group_count: int | None = None
    advance_per_group: int | None = None
    knockout_started_at: datetime | None = None
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


class StationCreate(BaseModel):
    """Request body for a new station: without a name it gets the next number ("Tisch 3", "Platz 3")."""
    name: str | None = Field(default=None, max_length=200)


class StationRename(BaseModel):
    """Request body for renaming a station."""
    name: str = Field(max_length=200)


class StationResponse(BaseModel):
    """A station of a tournament."""
    id: UUID
    name: str
    position: int

    model_config = {"from_attributes": True}


class TournamentState(BaseModel):
    """The cheap question "has anything changed?": the revision, nothing else."""
    revision: int


class InviteCreate(BaseModel):
    """Request body for a new invitation link."""
    label: str | None = Field(default=None, max_length=60)


class InviteResponse(BaseModel):
    """An invitation link of a tournament: how many accounts opened it and how many of them play."""
    id: UUID
    token: str
    label: str | None
    created_at: datetime
    deleted: bool = False
    opened: int = 0
    joined: int = 0


class TournamentPreview(BaseModel):
    """What a stranger may see of a tournament before joining: enough to decide, nothing about the participants."""
    tournament_id: UUID
    slug: str
    name: str
    location: str | None
    start_time: datetime | None
    registration_open: bool
    join_policy: JoinPolicy
    description: str | None = None
    phase: TournamentPhase
    team_count: int = 0
    # only a deadline that really closes the registration
    registration_end_time: datetime | None = None


class ParticipatingTournament(BaseModel):
    tournament: TournamentResponse
    team: TeamResponse
    # what the list shows about my part, without loading the bracket: check-in, the next match, the place at the end
    is_checked_in: bool = False
    next_match: MatchResponse | None = None  # the team's next match that is not finished (once started)
    place: int | None = None  # out or won: the place (1 = winner; knock-out places are shared: 3, 5, 9 ...)

    model_config = {"from_attributes": True}


class ManagedTournament(BaseModel):
    tournament: TournamentResponse
    role: TournamentRoleType

    model_config = {"from_attributes": True}


class MyTournamentsResponse(BaseModel):
    participating: list[ParticipatingTournament]
    managing: list[ManagedTournament]
