import secrets
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AlreadyTeamMemberError,
    InvalidInviteError,
    NotFoundError,
    TeamFullError,
)
from app.models.team import Team, TeamMember
from app.models.team_invite import TeamInvite


async def create_team(db: AsyncSession, name: str, creator_id: UUID) -> Team:
    """Create a new team and add the creator as the first member."""
    team = Team(name=name)
    db.add(team)
    await db.flush()

    member = TeamMember(team_id=team.id, user_id=creator_id)
    db.add(member)
    return team


async def get_team(db: AsyncSession, team_id: UUID) -> Team:
    """Get a team by ID or raise NotFoundError."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if team is None:
        raise NotFoundError("Team")
    return team


async def get_user_teams(db: AsyncSession, user_id: UUID) -> list[Team]:
    """Get all teams a user is a member of."""
    result = await db.execute(
        select(Team)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .where(TeamMember.user_id == user_id)
    )
    return list(result.scalars().all())


async def get_team_members(db: AsyncSession, team_id: UUID) -> list[TeamMember]:
    """Get all members of a team."""
    result = await db.execute(select(TeamMember).where(TeamMember.team_id == team_id))
    return list(result.scalars().all())


async def get_team_member_count(db: AsyncSession, team_id: UUID) -> int:
    """Count the number of members in a team."""
    result = await db.execute(
        select(func.count()).select_from(TeamMember).where(TeamMember.team_id == team_id)
    )
    return result.scalar_one()


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
        token=secrets.token_urlsafe(32),
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
