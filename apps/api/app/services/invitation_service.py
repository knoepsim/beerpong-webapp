from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.exceptions import AlreadyParticipantError, InvitationAnsweredError, NotFoundError
from app.models.team import Team, TeamMember
from app.models.tournament import Tournament, TournamentTeam
from app.models.tournament_invitation import InvitationStatus, TournamentInvitation
from app.models.tournament_invite import TournamentInvite
from app.models.user import User
from app.schemas.invitation import InvitationResponse, TournamentInvitationResponse
from app.services.invite_service import InviteService, build_preview
from app.services.revision import bump

PENDING = InvitationStatus.PENDING


class InvitationService:
    """Personal invitations: kept in the account of the invited person until they answer.

    The answer is the same for every way in (a link or the organization directly): accept with a team (that is the
    normal join, the invitation stands in for the link) or decline. Joining in any other way also counts as accepted,
    leaving makes the invitation open again.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    # -- reading

    async def _team_of(self, tournament_id: UUID, user_id: UUID) -> UUID | None:
        """The team the person plays with in this tournament, if any."""
        return (
            await self.db.execute(
                select(TournamentTeam.team_id)
                .join(TeamMember, TeamMember.team_id == TournamentTeam.team_id)
                .where(TournamentTeam.tournament_id == tournament_id, TeamMember.user_id == user_id)
            )
        ).scalar_one_or_none()

    async def _existing(self, tournament_id: UUID, user_id: UUID) -> TournamentInvitation | None:
        return (
            await self.db.execute(
                select(TournamentInvitation).where(
                    TournamentInvitation.tournament_id == tournament_id, TournamentInvitation.user_id == user_id
                )
            )
        ).scalar_one_or_none()

    async def _mine(self, invitation_id: UUID, user_id: UUID, for_update: bool = False) -> TournamentInvitation:
        query = select(TournamentInvitation).where(
            TournamentInvitation.id == invitation_id, TournamentInvitation.user_id == user_id
        )
        invitation = (await self.db.execute(query.with_for_update() if for_update else query)).scalar_one_or_none()
        if invitation is None:
            raise NotFoundError("Einladung")
        return invitation

    async def to_response(self, invitation: TournamentInvitation) -> InvitationResponse:
        tournament = await self.db.get(Tournament, invitation.tournament_id)
        inviter = await self.db.get(User, invitation.invited_by_id) if invitation.invited_by_id else None
        link = await self.db.get(TournamentInvite, invitation.invite_id) if invitation.invite_id else None
        team = await self.db.get(Team, invitation.team_id) if invitation.team_id else None
        return InvitationResponse(
            id=invitation.id,
            status=invitation.status,
            created_at=invitation.created_at,
            tournament=await build_preview(self.db, tournament),
            invited_by_name=inviter.name if inviter else None,
            link_label=(link.label or "Einladungslink") if link and not inviter else None,
            team_id=team.id if team else None,
            team_name=team.name if team else None,
        )

    async def list_mine(self, user_id: UUID) -> list[InvitationResponse]:
        """The open invitations of a person, while the tournament can still be joined (afterwards they lapse)."""
        rows = await self.db.execute(
            select(TournamentInvitation, Tournament)
            .join(Tournament, Tournament.id == TournamentInvitation.tournament_id)
            .where(
                TournamentInvitation.user_id == user_id,
                TournamentInvitation.status == PENDING,
                Tournament.is_deleted == False,  # noqa: E712
            )
            .order_by(Tournament.start_time)
        )
        return [await self.to_response(invitation) for invitation, tournament in rows.all() if tournament.registration_open]

    async def get_mine(self, invitation_id: UUID, user_id: UUID) -> InvitationResponse:
        return await self.to_response(await self._mine(invitation_id, user_id))

    async def list_for_tournament(self, tournament_id: UUID) -> list[TournamentInvitationResponse]:
        invitee, inviter = aliased(User), aliased(User)
        rows = await self.db.execute(
            select(TournamentInvitation, invitee.name, inviter.name, Team.name)
            .join(invitee, invitee.id == TournamentInvitation.user_id)
            .outerjoin(inviter, inviter.id == TournamentInvitation.invited_by_id)
            .outerjoin(Team, Team.id == TournamentInvitation.team_id)
            .where(TournamentInvitation.tournament_id == tournament_id)
            .order_by(TournamentInvitation.created_at)
        )
        return [
            TournamentInvitationResponse(
                id=invitation.id,
                user_id=invitation.user_id,
                user_name=user_name,
                status=invitation.status,
                invite_id=invitation.invite_id,
                invited_by_name=inviter_name,
                team_name=team_name,
                created_at=invitation.created_at,
            )
            for invitation, user_name, inviter_name, team_name in rows.all()
        ]

    # -- the way in

    async def _invite(
        self, tournament_id: UUID, user_id: UUID, *, invite_id: UUID | None = None, invited_by_id: UUID | None = None
    ) -> TournamentInvitation:
        """One invitation per person and tournament: a declined or removed one is opened again."""
        invitation = await self._existing(tournament_id, user_id)
        team_id = await self._team_of(tournament_id, user_id)
        if invitation is None:
            invitation = TournamentInvitation(
                tournament_id=tournament_id, user_id=user_id, invite_id=invite_id, invited_by_id=invited_by_id
            )
            self.db.add(invitation)
        elif invitation.status != InvitationStatus.ACCEPTED:
            # where somebody came from first stays; a new direct invitation names who invited
            invitation.invited_by_id = invited_by_id or invitation.invited_by_id
            invitation.invite_id = invitation.invite_id or invite_id
        invitation.status = InvitationStatus.ACCEPTED if team_id else PENDING
        invitation.team_id = team_id
        invitation.responded_at = datetime.now(UTC) if team_id else None
        await self.db.flush()
        await bump(self.db, tournament_id, "teams")
        return invitation

    async def open_link(self, token: str, user_id: UUID) -> InvitationResponse:
        """A logged-in person opened a link: the invitation is kept in their account from now on."""
        invite, tournament = await InviteService(self.db).find_by_token(token)
        invitation = await self._invite(tournament.id, user_id, invite_id=invite.id)
        return await self.to_response(invitation)

    async def invite_user(self, tournament_id: UUID, user_id: UUID, invited_by_id: UUID) -> TournamentInvitationResponse:
        if await self.db.get(User, user_id) is None:
            raise NotFoundError("Person")
        if await self._team_of(tournament_id, user_id):
            raise AlreadyParticipantError()
        invitation = await self._invite(tournament_id, user_id, invited_by_id=invited_by_id)
        return next(i for i in await self.list_for_tournament(tournament_id) if i.id == invitation.id)

    # -- the answer

    async def accept(self, invitation_id: UUID, user_id: UUID, team_id: UUID) -> InvitationResponse:
        from app.services.tournament_service import TournamentService  # it uses this service when a team joins

        invitation = await self._mine(invitation_id, user_id)
        if invitation.status != PENDING:
            raise InvitationAnsweredError()
        await TournamentService(self.db).join_tournament(invitation.tournament_id, team_id, user_id=user_id)
        await self.db.refresh(invitation)
        return await self.to_response(invitation)

    async def decline(self, invitation_id: UUID, user_id: UUID) -> InvitationResponse:
        invitation = await self._mine(invitation_id, user_id, for_update=True)
        if invitation.status != PENDING:
            raise InvitationAnsweredError()
        invitation.status = InvitationStatus.DECLINED
        invitation.responded_at = datetime.now(UTC)
        await bump(self.db, invitation.tournament_id, "teams")
        return await self.to_response(invitation)

    async def undo_decline(self, invitation_id: UUID, user_id: UUID) -> InvitationResponse:
        """Taking a decline back (the toast offers it right after)."""
        invitation = await self._mine(invitation_id, user_id, for_update=True)
        if invitation.status != InvitationStatus.DECLINED:
            raise InvitationAnsweredError()
        invitation.status = PENDING
        invitation.responded_at = None
        await bump(self.db, invitation.tournament_id, "teams")
        return await self.to_response(invitation)

    async def withdraw(self, tournament_id: UUID, invitation_id: UUID) -> None:
        """The organization removes an open invitation from the account of the person."""
        invitation = (
            await self.db.execute(
                select(TournamentInvitation).where(
                    TournamentInvitation.id == invitation_id, TournamentInvitation.tournament_id == tournament_id
                )
            )
        ).scalar_one_or_none()
        if invitation is None:
            raise NotFoundError("Einladung")
        if invitation.status != PENDING:
            raise InvitationAnsweredError()
        invitation.status = InvitationStatus.WITHDRAWN
        invitation.responded_at = datetime.now(UTC)
        await bump(self.db, tournament_id, "teams")

    # -- joining and leaving in any way

    async def has_open(self, tournament_id: UUID, user_id: UUID) -> TournamentInvitation | None:
        """An open invitation of the person: it stands in for the link of a tournament only open with invitation."""
        invitation = await self._existing(tournament_id, user_id)
        return invitation if invitation and invitation.status == PENDING else None

    async def team_joined(self, tournament_id: UUID, team_id: UUID, member_ids: list[UUID]) -> None:
        """Whoever of the team was invited has accepted."""
        await self.db.execute(
            update(TournamentInvitation)
            .where(
                TournamentInvitation.tournament_id == tournament_id,
                TournamentInvitation.user_id.in_(member_ids),
                TournamentInvitation.status == PENDING,
            )
            .values(status=InvitationStatus.ACCEPTED, team_id=team_id, responded_at=datetime.now(UTC))
        )

    async def team_left(self, tournament_id: UUID, team_id: UUID) -> None:
        """A team that leaves (or is removed): its invitations are open again, to join again while registration runs."""
        await self.db.execute(
            update(TournamentInvitation)
            .where(
                TournamentInvitation.tournament_id == tournament_id,
                TournamentInvitation.team_id == team_id,
                TournamentInvitation.status == InvitationStatus.ACCEPTED,
            )
            .values(status=PENDING, team_id=None, responded_at=None)
        )
