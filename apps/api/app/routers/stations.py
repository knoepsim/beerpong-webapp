from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.database import DbSession
from app.core.security import get_current_user
from app.models.tournament import Tournament
from app.models.tournament_role import TournamentRoleType
from app.models.user import User
from app.schemas.tournament import StationCreate, StationRename, StationResponse
from app.services.role_service import RoleService
from app.services.station_service import StationService
from app.services.tournament_service import TournamentService, get_accessible_tournament

router = APIRouter(prefix="/tournaments/{tournament_id}/stations", tags=["Stations"])


@router.get(
    "",
    response_model=list[StationResponse],
    summary="Spielstätten auflisten",
    description="Die Spielstätten des Turniers (Tische, Plätze, je nach Spiel) in der Reihenfolge, in der sie angelegt wurden.",
)
async def list_stations(
    tournament: Annotated[Tournament, Depends(get_accessible_tournament)],
    db: DbSession,
):
    return await StationService(db).list_stations(tournament.id)


@router.post(
    "",
    response_model=StationResponse,
    status_code=201,
    summary="Spielstätte hinzufügen",
    description="Fügt eine Spielstätte hinzu. Ohne Namen bekommt sie die nächste Nummer (\"Tisch 3\", \"Platz 3\"). "
    "Nur Admin und Manager.",
)
async def add_station(
    tournament_id: UUID,
    body: StationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await TournamentService(db).get_tournament(tournament_id)
    return await StationService(db).add(tournament_id, body.name)


@router.patch(
    "/{station_id}",
    response_model=StationResponse,
    summary="Spielstätte umbenennen",
    description="Nur Admin und Manager. Der Name muss im Turnier eindeutig sein (Groß-/Kleinschreibung egal).",
)
async def rename_station(
    tournament_id: UUID,
    station_id: UUID,
    body: StationRename,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    return await StationService(db).rename(tournament_id, station_id, body.name)


@router.delete(
    "/{station_id}",
    status_code=204,
    summary="Spielstätte löschen",
    description="Löscht eine Spielstätte. Die letzte eines Turniers kann nicht gelöscht werden. Nur Admin und Manager.",
)
async def delete_station(
    tournament_id: UUID,
    station_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await StationService(db).delete(tournament_id, station_id)
