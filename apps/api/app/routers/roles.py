from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.database import DbSession
from app.core.security import get_current_user, get_optional_user
from app.models.tournament import Tournament
from app.models.user import User
from app.schemas.tournament_role import RoleAssignRequest, TournamentUserRoleResponse
from app.services.role_service import RoleService
from app.services.tournament_service import TournamentService, get_accessible_tournament

router = APIRouter(prefix="/tournaments/{tournament_id}/roles", tags=["Roles"])


@router.post(
    "",
    response_model=TournamentUserRoleResponse,
    status_code=201,
    summary="Rolle vergeben",
    description="Weist einem registrierten Nutzer eine Rolle im Turnier zu. "
    "Admin kann alle Rollen vergeben, Manager nur Schiedsrichter.",
)
async def assign_role(
    tournament_id: UUID,
    body: RoleAssignRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    return await RoleService(db).assign_role(
        tournament_id, body.user_id, body.role, current_user.id
    )


@router.delete(
    "/{role_id}",
    status_code=204,
    summary="Rolle entziehen",
    description="Entzieht eine Rollenzuweisung. Höherrangige Rollen können niedrigrangige entziehen.",
)
async def revoke_role(
    tournament_id: UUID,
    role_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await RoleService(db).revoke_role(tournament_id, role_id, current_user.id)


@router.get(
    "",
    response_model=list[TournamentUserRoleResponse],
    summary="Alle Rollen im Turnier",
    description="Listet alle Rollenzuweisungen für ein Turnier auf.",
)
async def list_roles(
    tournament: Annotated[Tournament, Depends(get_accessible_tournament)],
    viewer: Annotated[User | None, Depends(get_optional_user)],
    db: DbSession,
):
    # who helps is for those who play or help themselves, not for strangers
    if not await TournamentService(db).is_involved(tournament.id, viewer.id if viewer else None):
        return []
    return await RoleService(db).list_roles(tournament.id)
