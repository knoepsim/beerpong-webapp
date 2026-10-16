from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.database import DbSession
from app.core.security import get_current_user
from app.models.tournament import Tournament
from app.models.tournament_role import TournamentRoleType
from app.models.user import User
from app.schemas.tournament import TableCreate, TableRename, TableResponse
from app.services.role_service import RoleService
from app.services.table_service import TableService
from app.services.tournament_service import TournamentService, get_accessible_tournament

router = APIRouter(prefix="/tournaments/{tournament_id}/tables", tags=["Tables"])


@router.get(
    "",
    response_model=list[TableResponse],
    summary="Tische auflisten",
    description="Die Tische des Turniers in der Reihenfolge, in der sie angelegt wurden.",
)
async def list_tables(
    tournament: Annotated[Tournament, Depends(get_accessible_tournament)],
    db: DbSession,
):
    return await TableService(db).list_tables(tournament.id)


@router.post(
    "",
    response_model=TableResponse,
    status_code=201,
    summary="Tisch hinzufügen",
    description="Fügt einen Tisch hinzu. Ohne Namen heißt er \"Tisch {n}\". Nur Admin und Manager.",
)
async def add_table(
    tournament_id: UUID,
    body: TableCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await TournamentService(db).get_tournament(tournament_id)
    return await TableService(db).add(tournament_id, body.name)


@router.patch(
    "/{table_id}",
    response_model=TableResponse,
    summary="Tisch umbenennen",
    description="Nur Admin und Manager. Der Name muss im Turnier eindeutig sein (Groß-/Kleinschreibung egal).",
)
async def rename_table(
    tournament_id: UUID,
    table_id: UUID,
    body: TableRename,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    return await TableService(db).rename(tournament_id, table_id, body.name)


@router.delete(
    "/{table_id}",
    status_code=204,
    summary="Tisch löschen",
    description="Löscht einen Tisch. Der letzte Tisch eines Turniers kann nicht gelöscht werden. Nur Admin und Manager.",
)
async def delete_table(
    tournament_id: UUID,
    table_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await TableService(db).delete(tournament_id, table_id)
