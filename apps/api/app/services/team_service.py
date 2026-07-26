import secrets
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AlreadyTeamMemberError,
    InvalidInviteError,
    NotFoundError,
    TeamFullError,
)
from app.models.team import Team, TeamMember
from app.models.team_invite import TeamInvite
from app.repositories.team_repository import team_repository


async def create_team(db: AsyncSession, name: str, creator_id: UUID) -> Team:
    """Create a new team and add the creator as the first member."""
    team = await team_repository.create(db, obj_in={"name": name})
    await db.flush()

    member = TeamMember(team_id=team.id, user_id=creator_id)
    db.add(member)
    return team


async def get_team(db: AsyncSession, team_id: UUID) -> Team:
    """Get a team by ID or raise NotFoundError. Ensures team is not deleted."""
    team = await team_repository.get_by_id_active(db, team_id)
    if team is None:
        raise NotFoundError("Team")
    return team


async def get_user_teams(db: AsyncSession, user_id: UUID) -> list[Team]:
    """Get all teams a user is a member of (excluding deleted)."""
    return await team_repository.get_user_teams(db, user_id)


async def get_team_members(db: AsyncSession, team_id: UUID) -> list[TeamMember]:
    """Get all members of a team."""
    return await team_repository.get_team_members(db, team_id)


async def get_team_members_with_names(db: AsyncSession, team_id: UUID) -> list[dict]:
    """Get all members of a team including their names."""
    return await team_repository.get_team_members_with_names(db, team_id)


async def get_team_member_count(db: AsyncSession, team_id: UUID) -> int:
    """Count the number of members in a team."""
    return await team_repository.get_team_member_count(db, team_id)


async def get_team_flags(db: AsyncSession, team_id: UUID) -> tuple[bool, bool]:
    """Returns (is_deletable, is_renamable)."""
    return await team_repository.get_team_flags(db, team_id)


async def update_team(db: AsyncSession, team_id: UUID, name: str) -> Team:
    team = await get_team(db, team_id)
    return await team_repository.update(db, db_obj=team, obj_in={"name": name})


async def soft_delete_team(db: AsyncSession, team_id: UUID) -> None:
    team = await get_team(db, team_id)
    await team_repository.update(db, db_obj=team, obj_in={"is_deleted": True})


async def create_invite(db: AsyncSession, team_id: UUID, user_id: UUID) -> TeamInvite:
    """Generate a new invite token for a team. Only team members can create invites."""
    # Verify user is a member of the team
    result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
    )
    if result.scalar_one_or_none() is None:
        raise NotFoundError("Team membership")

    invite = TeamInvite(
        team_id=team_id,
        token=secrets.token_urlsafe(6),
    )
    db.add(invite)
    await db.flush()
    return invite


async def accept_invite(db: AsyncSession, token: str, user_id: UUID) -> Team:
    """Accept a team invite: validate token, check capacity, add member, invalidate token."""
    # Find the invite
    result = await db.execute(select(TeamInvite).where(TeamInvite.token == token))
    invite = result.scalar_one_or_none()

    if invite is None or invite.is_used:
        raise InvalidInviteError()

    team = await get_team(db, invite.team_id)

    # Check if user is already a member
    existing = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == user_id)
    )
    if existing.scalar_one_or_none() is not None:
        raise AlreadyTeamMemberError()

    # Check team capacity
    member_count = await get_team_member_count(db, team.id)
    if member_count >= team.max_size:
        raise TeamFullError()

    # Add member
    member = TeamMember(team_id=team.id, user_id=user_id)
    db.add(member)

    # Invalidate invite if team is now full
    new_count = member_count + 1
    if new_count >= team.max_size:
        invite.is_used = True

    return team
