import secrets
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AlreadyTeamMemberError,
    InvalidInviteError,
    NotFoundError,
    TeamFullError,
    TeamInTournamentError,
)
from app.models.team import Team, TeamMember
from app.models.team_invite import TeamInvite
from app.repositories.team_repository import team_repository
from app.schemas.team import TeamDeleteBlocker, TeamMemberResponse, TeamResponse
from app.core.database import DbSession
from app.services.revision import bump_for_team


class TeamService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_team(self, name: str, creator_id: UUID) -> Team:
        """Create a new team and add the creator as the first member."""
        team = await team_repository.create(self.db, obj_in={"name": name})
        await self.db.flush()

        member = TeamMember(team_id=team.id, user_id=creator_id)
        self.db.add(member)
        return team


    async def get_team(self, team_id: UUID, *, for_update: bool = False) -> Team:
        """Get a team by ID or raise NotFoundError. Ensures team is not deleted."""
        team = await team_repository.get_by_id_active(self.db, team_id, for_update=for_update)
        if team is None:
            raise NotFoundError("Team")
        return team


    async def get_user_teams(self, user_id: UUID) -> list[Team]:
        """Get all teams a user is a member of (excluding deleted)."""
        return await team_repository.get_user_teams(self.db, user_id)


    async def get_team_members(self, team_id: UUID) -> list[TeamMember]:
        """Get all members of a team."""
        return await team_repository.get_team_members(self.db, team_id)


    async def get_team_members_with_names(self, team_id: UUID) -> list[dict]:
        """Get all members of a team including their names."""
        return await team_repository.get_team_members_with_names(self.db, team_id)


    async def get_members_with_names_for_teams(self, team_ids: list[UUID]) -> dict[UUID, list[dict]]:
        return await team_repository.get_members_with_names_for_teams(self.db, team_ids)

    async def get_team_member_count(self, team_id: UUID) -> int:
        """Count the number of members in a team."""
        return await team_repository.get_team_member_count(self.db, team_id)


    async def get_delete_blockers(self, team_id: UUID) -> list[TeamDeleteBlocker]:
        """Why a team cannot be deleted right now: the tournaments it plays in or is registered for."""
        return [
            TeamDeleteBlocker(
                tournament_name=t.name,
                tournament_slug=t.slug,
                running=t.is_started,
                registration_open=t.registration_open,
            )
            for t in await team_repository.get_delete_blockers(self.db, team_id)
        ]

    async def to_response(self, team: Team) -> TeamResponse:
        """A team for its members: players and what keeps it from being deleted."""
        members = await self.get_team_members_with_names(team.id)
        return TeamResponse(
            id=team.id,
            name=team.name,
            max_size=team.max_size,
            members=[TeamMemberResponse.model_validate(m) for m in members],
            is_complete=len(members) >= team.max_size,
            delete_blockers=await self.get_delete_blockers(team.id),
            created_at=team.created_at,
        )


    async def update_team(self, team_id: UUID, name: str) -> Team:
        """Rename a team. Always allowed: tournaments that started keep the name the team had then."""
        team = await self.get_team(team_id)
        updated = await team_repository.update(self.db, db_obj=team, obj_in={"name": name})
        await bump_for_team(self.db, team_id, "teams", "bracket")
        return updated


    async def soft_delete_team(self, team_id: UUID) -> None:
        """Hide a team (its finished tournaments keep it); not while it plays in or is registered for one."""
        team = await self.get_team(team_id, for_update=True)
        blockers = await self.get_delete_blockers(team_id)
        if blockers:
            first = blockers[0]
            if first.running:
                raise TeamInTournamentError(
                    f"Das Team spielt gerade in „{first.tournament_name}“. Löschen geht nach dem Turnier."
                )
            raise TeamInTournamentError(
                f"Das Team ist für „{first.tournament_name}“ angemeldet. "
                + ("Melde es dort ab, dann kannst du es löschen." if first.registration_open else "Löschen geht nach dem Turnier.")
            )
        await team_repository.update(self.db, db_obj=team, obj_in={"is_deleted": True})


    async def create_invite(self, team_id: UUID, user_id: UUID) -> TeamInvite:
        """Generate a new invite token for a team. Only team members can create invites."""
        # Verify user is a member of the team
        result = await self.db.execute(
            select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        )
        if result.scalar_one_or_none() is None:
            raise NotFoundError("Teammitgliedschaft")

        invite = TeamInvite(
            team_id=team_id,
            token=secrets.token_urlsafe(6),
        )
        self.db.add(invite)
        await self.db.flush()
        return invite


    async def get_invite_details(self, token: str) -> dict:
        """Get details about an invite to display before accepting."""
        result = await self.db.execute(select(TeamInvite).where(TeamInvite.token == token))
        invite = result.scalar_one_or_none()

        if invite is None or invite.is_used:
            raise InvalidInviteError()

        team = await self.get_team(invite.team_id)
        members = await self.get_team_members_with_names(team.id)
        inviter_name = members[0]["name"] if members else "jemandem"

        return {
            "team_id": team.id,
            "team_name": team.name,
            "inviter_name": inviter_name
        }


    async def accept_invite(self, token: str, user_id: UUID) -> Team:
        """Accept a team invite: validate token, check capacity, add member, invalidate token."""
        # Find the invite
        result = await self.db.execute(select(TeamInvite).where(TeamInvite.token == token))
        invite = result.scalar_one_or_none()

        if invite is None or invite.is_used:
            raise InvalidInviteError()

        # Lock the team: concurrent accepts are serialized, so the capacity check below is reliable
        team = await self.get_team(invite.team_id, for_update=True)

        # Check if user is already a member
        existing = await self.db.execute(
            select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == user_id)
        )
        if existing.scalar_one_or_none() is not None:
            raise AlreadyTeamMemberError()

        # Check team capacity
        member_count = await self.get_team_member_count(team.id)
        if member_count >= team.max_size:
            raise TeamFullError()

        # Add member
        member = TeamMember(team_id=team.id, user_id=user_id)
        self.db.add(member)
        await bump_for_team(self.db, team.id, "teams")

        # Invalidate invite if team is now full
        new_count = member_count + 1
        if new_count >= team.max_size:
            invite.is_used = True

        return team



def get_team_service(db: DbSession) -> TeamService:
    return TeamService(db)
