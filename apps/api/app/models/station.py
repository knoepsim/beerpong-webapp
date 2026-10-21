import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Station(Base):
    """Where a match is played (a table, a pitch: the game names it, app/games.py). At least one per tournament,
    named "Tisch 1", "Platz 1", ... by default and renamable."""

    __tablename__ = "stations"
    __table_args__ = (UniqueConstraint("tournament_id", "name", name="uq_station_name"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tournaments.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    # order of creation: stations are listed the way they were added
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
