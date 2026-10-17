import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.slug import random_slug


class TournamentInvite(Base):
    """An invitation link /invite/{token}: whoever opens it while logged in gets a personal invitation."""

    __tablename__ = "tournament_invites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tournaments.id"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(7), unique=True, index=True, nullable=False, default=random_slug)
    label: Mapped[str | None] = mapped_column(String(60), nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # a deleted link does not work any more, but stays with the invitations it brought (shown as deleted)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
