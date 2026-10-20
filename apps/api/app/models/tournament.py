import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.slug import random_slug


class Game(str, enum.Enum):
    """What is played. It decides how a result is entered (for beer pong: the cups that are left)."""

    BEERPONG = "beerpong"
    FOOTBALL = "football"


class TournamentMode(str, enum.Enum):
    """How the teams meet. Only the modes that are implemented; the app shows the coming ones as not available."""

    SINGLE_ELIMINATION = "single_elimination"


class TournamentVisibility(str, enum.Enum):
    """Who sees the bracket and the results: everybody, or only participants and helpers."""

    PUBLIC = "public"
    PRIVATE = "private"


class JoinPolicy(str, enum.Enum):
    """Who may join with a team: anybody who knows the address, or only with an invitation link."""

    OPEN = "open"
    INVITE_ONLY = "invite_only"


class TournamentPhase(str, enum.Enum):
    REGISTRATION = "registration"
    REGISTRATION_AND_CHECKIN = "registration_and_checkin"
    REGISTRATION_CLOSED = "registration_closed"
    CHECKIN = "checkin"
    RUNNING = "running"
    FINISHED = "finished"


def _aware(value: datetime | None) -> datetime | None:
    """Treat naive timestamps (SQLite) as UTC so they can be compared with aware ones."""
    return value if value is None or value.tzinfo else value.replace(tzinfo=UTC)


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # raised by every change a viewer can see (see services/revision.py); the browsers compare it to what they hold
    revision: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    # address /t/{slug}; unique over all tournaments, deleted ones included, so an old link never leads somewhere else
    slug: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False, default=random_slug)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(String(5000), nullable=True)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    registration_end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checkin_start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # set while the final has a result: the tournament is over
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Registration and check-in are two independent switches the organizer can flip at any time.
    # *_changed_at is the last manual flip; with *_auto the schedule above flips the switch at its time
    # (registration closes at registration_end_time, check-in opens at checkin_start_time), unless the
    # organizer flipped it after that time.
    registration_is_open: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    registration_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    registration_auto_close: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    checkin_is_open: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    checkin_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checkin_auto_open: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    checkin_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    game: Mapped[Game] = mapped_column(Enum(Game), nullable=False)
    mode: Mapped[TournamentMode] = mapped_column(Enum(TournamentMode), nullable=False)
    visibility: Mapped[TournamentVisibility] = mapped_column(Enum(TournamentVisibility), nullable=False)
    join_policy: Mapped[JoinPolicy] = mapped_column(
        Enum(JoinPolicy), default=JoinPolicy.OPEN, server_default=JoinPolicy.OPEN.name, nullable=False
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def is_started(self) -> bool:
        return self.started_at is not None

    @property
    def _checkin_opened_manually(self) -> bool:
        return self.checkin_enabled and self.checkin_opened_at is not None

    @staticmethod
    def _switch(
        is_open: bool,
        changed_at: datetime | None,
        auto: bool,
        at: datetime | None,
        auto_state: bool,
        now: datetime | None = None,
    ) -> bool:
        """State of a switch: the schedule sets `auto_state` at its time, a later manual flip wins."""
        due = _aware(at)
        if auto and due is not None and (now or datetime.now(UTC)) >= due:
            changed = _aware(changed_at)
            if changed is None or changed < due:
                return auto_state
        return is_open

    @property
    def registration_open(self) -> bool:
        """Teams can join while registration is switched on (it closes by itself at the deadline if wanted)."""
        if self.is_started:
            return False
        return self._switch(
            self.registration_is_open,
            self.registration_changed_at,
            self.registration_auto_close,
            self.registration_end_time,
            False,
        )

    @property
    def checkin_open(self) -> bool:
        """Check-in only exists if enabled; it is switched on by the organizer or by itself at its start time."""
        if not self.checkin_enabled or self.is_started:
            return False
        return self._switch(
            self.checkin_is_open, self.checkin_changed_at, self.checkin_auto_open, self.checkin_start_time, True
        )

    @property
    def phase(self) -> TournamentPhase:
        if self.finished_at is not None:
            return TournamentPhase.FINISHED
        if self.is_started:
            return TournamentPhase.RUNNING
        registration, checkin = self.registration_open, self.checkin_open
        if registration and checkin:
            return TournamentPhase.REGISTRATION_AND_CHECKIN
        if registration:
            return TournamentPhase.REGISTRATION
        if checkin:
            return TournamentPhase.CHECKIN
        return TournamentPhase.REGISTRATION_CLOSED


class TournamentTeam(Base):
    __tablename__ = "tournament_teams"
    __table_args__ = (UniqueConstraint("tournament_id", "team_id", name="uq_tournament_team"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tournaments.id"), nullable=False
    )
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)
    is_checked_in: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # the team's name when the tournament started: the tournament keeps it, a later renaming does not change history
    team_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # the invitation link this team joined with (if any); kept only to count what a link brought
    invite_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tournament_invites.id", ondelete="SET NULL"), nullable=True
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
