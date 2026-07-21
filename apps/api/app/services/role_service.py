from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InsufficientRoleError, NotFoundError
from app.models.tournament_role import ROLE_HIERARCHY, TournamentRoleType, TournamentUserRole


async def get_user_roles(
    db: AsyncSession, tournament_id: UUID, user_id: UUID
) -> list[TournamentUserRole]:
    """Get all roles a user has in a specific tournament."""
    result = await db.execute(
        select(TournamentUserRole).where(
            TournamentUserRole.tournament_id == tournament_id,
            TournamentUserRole.user_id == user_id,
        )
    )
    return list(result.scalars().all())


async def get_highest_role(
    db: AsyncSession, tournament_id: UUID, user_id: UUID
) -> TournamentRoleType | None:
    """Get the highest-ranked role a user has in a tournament."""
    roles = await get_user_roles(db, tournament_id, user_id)
    if not roles:
        return None
    return max((r.role for r in roles), key=lambda r: ROLE_HIERARCHY[r])


async def require_role(
    db: AsyncSession, tournament_id: UUID, user_id: UUID, min_role: TournamentRoleType
) -> None:
    """Raise InsufficientRoleError if user doesn't have at least min_role."""
    highest = await get_highest_role(db, tournament_id, user_id)
    if highest is None or ROLE_HIERARCHY[highest] < ROLE_HIERARCHY[min_role]:
        raise InsufficientRoleError()


async def assign_role(
    db: AsyncSession,
    tournament_id: UUID,
    target_user_id: UUID,
    role: TournamentRoleType,
    assigner_id: UUID,
) -> TournamentUserRole:
    """Assign a role to a user in a tournament with hierarchy checks.

    - Admin can assign any role
    - Manager can only assign Referee
    """
    assigner_highest = await get_highest_role(db, tournament_id, assigner_id)
    if assigner_highest is None:
        raise InsufficientRoleError("You have no role in this tournament")

    # Manager can only assign Referee
    if assigner_highest == TournamentRoleType.MANAGER and role != TournamentRoleType.REFEREE:
        raise InsufficientRoleError("Managers can only assign the Referee role")

    # Referee cannot assign any role
    if assigner_highest == TournamentRoleType.REFEREE:
        raise InsufficientRoleError("Referees cannot assign roles")

    # Check if role already exists
    existing = await db.execute(
        select(TournamentUserRole).where(
            TournamentUserRole.tournament_id == tournament_id,
            TournamentUserRole.user_id == target_user_id,
            TournamentUserRole.role == role,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise InsufficientRoleError("User already has this role")

    new_role = TournamentUserRole(
        tournament_id=tournament_id,
        user_id=target_user_id,
        role=role,
    )
    db.add(new_role)
    return new_role


async def revoke_role(
    db: AsyncSession,
    tournament_id: UUID,
    role_id: UUID,
    revoker_id: UUID,
) -> None:
    """Revoke a role assignment. Higher-ranked roles can revoke lower-ranked ones."""
    result = await db.execute(
        select(TournamentUserRole).where(TournamentUserRole.id == role_id)
    )
    role_entry = result.scalar_one_or_none()
    if role_entry is None:
        raise NotFoundError("Role assignment")

    if role_entry.tournament_id != tournament_id:
        raise NotFoundError("Role assignment")

    revoker_highest = await get_highest_role(db, tournament_id, revoker_id)
    if revoker_highest is None:
        raise InsufficientRoleError()

    # Must outrank the role being revoked
    if ROLE_HIERARCHY[revoker_highest] <= ROLE_HIERARCHY[role_entry.role]:
        raise InsufficientRoleError("Cannot revoke a role of equal or higher rank")

    await db.delete(role_entry)


async def list_roles(db: AsyncSession, tournament_id: UUID) -> list[TournamentUserRole]:
    """List all role assignments for a tournament."""
    result = await db.execute(
        select(TournamentUserRole).where(TournamentUserRole.tournament_id == tournament_id)
    )
    return list(result.scalars().all())
