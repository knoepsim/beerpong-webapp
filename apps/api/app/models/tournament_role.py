import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class TournamentRoleType(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    REFEREE = "referee"


# Role hierarchy for permission checks (higher value = more powerful)
ROLE_HIERARCHY: dict[TournamentRoleType, int] = {
    TournamentRoleType.REFEREE: 1,
    TournamentRoleType.MANAGER: 2,
    TournamentRoleType.ADMIN: 3,
}


class TournamentUserRole(Base):
    __tablename__ = "tournament_user_roles"
    __table_args__ = (UniqueConstraint("tournament_id", "user_id", "role", name="uq_tournament_user_role"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tournaments.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role: Mapped[TournamentRoleType] = mapped_column(Enum(TournamentRoleType), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", lazy="joined")

    @property
    def user_name(self) -> str | None:
        return self.user.name if self.user else None
