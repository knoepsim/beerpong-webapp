import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TournamentMode(str, enum.Enum):
    SINGLE_ELIMINATION = "single_elimination"


class TournamentVisibility(str, enum.Enum):
    PRIVATE = "private"
    PUBLIC_LISTED = "public_listed"
    PUBLIC_UNLISTED = "public_unlisted"


class TournamentPhase(str, enum.Enum):
    REGISTRATION = "registration"
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
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(String(5000), nullable=True)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    registration_end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checkin_start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # set while the final has a result: the tournament is over
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checkin_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    table_count: Mapped[int] = mapped_column(Integer, default=1)
    mode: Mapped[TournamentMode] = mapped_column(Enum(TournamentMode), nullable=False)
    visibility: Mapped[TournamentVisibility] = mapped_column(Enum(TournamentVisibility), nullable=False)
    invite_token: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
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
    def registration_open(self) -> bool:
        """Teams can join until the registration deadline (if any) and before the start."""
        if self.is_started:
            return False
        deadline = _aware(self.registration_end_time)
        return deadline is None or datetime.now(UTC) < deadline

    @property
    def checkin_open(self) -> bool:
        """Check-in only exists if enabled and ends at the start.

        It opens at checkin_start_time, otherwise when the registration closes, without any
        deadline it is open right away.
        """
        if not self.checkin_enabled or self.is_started:
            return False
        opens_at = _aware(self.checkin_start_time or self.registration_end_time)
        return opens_at is None or datetime.now(UTC) >= opens_at

    @property
    def phase(self) -> TournamentPhase:
        if self.finished_at is not None:
            return TournamentPhase.FINISHED
        if self.is_started:
            return TournamentPhase.RUNNING
        if self.registration_open:
            return TournamentPhase.REGISTRATION
        if self.checkin_open:
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
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
