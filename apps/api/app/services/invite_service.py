from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.slug import random_slug
from app.models.tournament import Tournament, TournamentTeam
from app.models.tournament_invite import TournamentInvite
from app.schemas.tournament import InviteResponse, TournamentPreview


def preview_of(tournament: Tournament) -> TournamentPreview:
    return TournamentPreview(
        tournament_id=tournament.id,
        slug=tournament.slug,
        name=tournament.name,
        location=tournament.location,
        start_time=tournament.start_time,
        registration_open=tournament.registration_open,
        join_policy=tournament.join_policy,
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
            select(TournamentInvite.id).where(TournamentInvite.tournament_id == tournament_id).limit(1)
        )
        if existing.first() is None:
            await self.create(tournament_id, user_id)

    async def list(self, tournament_id: UUID) -> list[InviteResponse]:
        uses = (
            select(TournamentTeam.invite_id, func.count().label("uses"))
            .where(TournamentTeam.invite_id.is_not(None))
            .group_by(TournamentTeam.invite_id)
            .subquery()
        )
        rows = await self.db.execute(
            select(TournamentInvite, func.coalesce(uses.c.uses, 0))
            .outerjoin(uses, uses.c.invite_id == TournamentInvite.id)
            .where(TournamentInvite.tournament_id == tournament_id)
            .order_by(TournamentInvite.created_at)
        )
        return [
            InviteResponse(id=i.id, token=i.token, label=i.label, created_at=i.created_at, uses=count)
            for i, count in rows.all()
        ]

    async def delete(self, tournament_id: UUID, invite_id: UUID) -> None:
        invite = (
            await self.db.execute(
                select(TournamentInvite).where(
                    TournamentInvite.id == invite_id, TournamentInvite.tournament_id == tournament_id
                )
            )
        ).scalar_one_or_none()
        if invite is None:
            raise NotFoundError("Invite")
        await self.db.delete(invite)

    async def find(self, tournament_id: UUID, token: str | None) -> TournamentInvite | None:
        if not token:
            return None
        return (
            await self.db.execute(
                select(TournamentInvite).where(
                    TournamentInvite.tournament_id == tournament_id, TournamentInvite.token == token
                )
            )
        ).scalar_one_or_none()

    async def preview(self, token: str) -> TournamentPreview:
        """The tournament behind a link. Unknown links and links of deleted tournaments answer the same."""
        row = await self.db.execute(
            select(Tournament)
            .join(TournamentInvite, TournamentInvite.tournament_id == Tournament.id)
            .where(TournamentInvite.token == token, Tournament.is_deleted == False)  # noqa: E712
        )
        tournament = row.scalar_one_or_none()
        if tournament is None:
            raise NotFoundError("Invite")
        return preview_of(tournament)
