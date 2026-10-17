from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.slug import random_slug
from app.models.tournament import Tournament, TournamentTeam
from app.models.tournament_invitation import InvitationStatus, TournamentInvitation
from app.models.tournament_invite import TournamentInvite
from app.schemas.tournament import InviteResponse, TournamentPreview


async def build_preview(db: AsyncSession, tournament: Tournament) -> TournamentPreview:
    """What somebody may see of a tournament before taking part: enough to decide, nothing about the participants."""
    team_count = (
        await db.execute(select(func.count()).select_from(TournamentTeam).where(TournamentTeam.tournament_id == tournament.id))
    ).scalar_one()
    return TournamentPreview(
        tournament_id=tournament.id,
        slug=tournament.slug,
        name=tournament.name,
        location=tournament.location,
        description=tournament.description,
        start_time=tournament.start_time,
        registration_open=tournament.registration_open,
        join_policy=tournament.join_policy,
        phase=tournament.phase,
        team_count=team_count,
        registration_end_time=tournament.registration_end_time if tournament.registration_auto_close else None,
    )


class InviteService:
    """Invitation links of a tournament: /invite/{token}, as many as the organizer wants."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _unused_token(self) -> str:
        while True:
            token = random_slug(7)
            if (await self.db.execute(select(TournamentInvite.id).where(TournamentInvite.token == token))).first() is None:
                return token

    async def create(self, tournament_id: UUID, user_id: UUID, label: str | None = None) -> TournamentInvite:
        invite = TournamentInvite(
            tournament_id=tournament_id,
            token=await self._unused_token(),
            label=(label or "").strip() or None,
            created_by_id=user_id,
        )
        self.db.add(invite)
        await self.db.flush()
        return invite

    async def ensure_one(self, tournament_id: UUID, user_id: UUID) -> None:
        """A tournament that is only open with an invitation needs at least one link to start with."""
        existing = await self.db.execute(
            select(TournamentInvite.id)
            .where(TournamentInvite.tournament_id == tournament_id, TournamentInvite.deleted_at.is_(None))
            .limit(1)
        )
        if existing.first() is None:
            await self.create(tournament_id, user_id)

    async def list(self, tournament_id: UUID) -> list[InviteResponse]:
        """All links, deleted ones too (they keep what they brought), with the accounts that opened them."""
        counts = (
            select(
                TournamentInvitation.invite_id,
                func.count().label("opened"),
                func.sum(case((TournamentInvitation.status == InvitationStatus.ACCEPTED, 1), else_=0)).label("joined"),
            )
            .where(TournamentInvitation.invite_id.is_not(None))
            .group_by(TournamentInvitation.invite_id)
            .subquery()
        )
        rows = await self.db.execute(
            select(TournamentInvite, func.coalesce(counts.c.opened, 0), func.coalesce(counts.c.joined, 0))
            .outerjoin(counts, counts.c.invite_id == TournamentInvite.id)
            .where(TournamentInvite.tournament_id == tournament_id)
            .order_by(TournamentInvite.created_at)
        )
        return [self.to_response(invite, opened, joined) for invite, opened, joined in rows.all()]

    @staticmethod
    def to_response(invite: TournamentInvite, opened: int = 0, joined: int = 0) -> InviteResponse:
        return InviteResponse(
            id=invite.id,
            token=invite.token,
            label=invite.label,
            created_at=invite.created_at,
            deleted=invite.deleted_at is not None,
            opened=opened,
            joined=joined,
        )

    async def delete(self, tournament_id: UUID, invite_id: UUID) -> None:
        """The link stops working; the invitations it brought stay (open ones too)."""
        invite = (
            await self.db.execute(
                select(TournamentInvite).where(
                    TournamentInvite.id == invite_id,
                    TournamentInvite.tournament_id == tournament_id,
                    TournamentInvite.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if invite is None:
            raise NotFoundError("Einladungslink")
        invite.deleted_at = datetime.now(UTC)

    async def find(self, tournament_id: UUID, token: str | None) -> TournamentInvite | None:
        if not token:
            return None
        return (
            await self.db.execute(
                select(TournamentInvite).where(
                    TournamentInvite.tournament_id == tournament_id,
                    TournamentInvite.token == token,
                    TournamentInvite.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

    async def find_by_token(self, token: str) -> tuple[TournamentInvite, Tournament]:
        """A working link and its tournament. Unknown links, deleted links and deleted tournaments answer the same."""
        row = (
            await self.db.execute(
                select(TournamentInvite, Tournament)
                .join(Tournament, TournamentInvite.tournament_id == Tournament.id)
                .where(
                    TournamentInvite.token == token,
                    TournamentInvite.deleted_at.is_(None),
                    Tournament.is_deleted == False,  # noqa: E712
                )
            )
        ).first()
        if row is None:
            raise NotFoundError("Einladung")
        return row[0], row[1]

    async def preview(self, token: str) -> TournamentPreview:
        """The tournament behind a link."""
        _, tournament = await self.find_by_token(token)
        return await build_preview(self.db, tournament)
