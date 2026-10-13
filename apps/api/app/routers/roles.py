from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.tournament_role import RoleAssignRequest, TournamentUserRoleResponse
from app.services.role_service import RoleService

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
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await role_service.assign_role(
        db, tournament_id, body.user_id, body.role, current_user.id
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
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RoleService(db).revoke_role(tournament_id, role_id, current_user.id)


@router.get(
    "",
    response_model=list[TournamentUserRoleResponse],
    summary="Alle Rollen im Turnier",
    description="Listet alle Rollenzuweisungen für ein Turnier auf.",
)
async def list_roles(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await RoleService(db).list_roles(tournament_id)
