from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.tournament_role import TournamentRoleType
from app.models.user import User
from app.schemas.match import BracketResponse
from app.schemas.tournament import TournamentCreate, TournamentJoinRequest, TournamentResponse, TournamentUpdate
from app.services import bracket_service, role_service, tournament_service

router = APIRouter(prefix="/tournaments", tags=["Tournaments"])


@router.post(
    "",
    response_model=TournamentResponse,
    status_code=201,
    summary="Turnier erstellen",
    description="Erstellt ein neues Turnier. Der Ersteller erhält automatisch die Admin-Rolle.",
)
async def create_tournament(
    body: TournamentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await tournament_service.create_tournament(db, body, current_user.id)


@router.get(
    "",
    response_model=list[TournamentResponse],
    summary="Turniere auflisten",
    description="Listet alle öffentlich gelisteten Turniere sowie Turniere, "
    "in denen der User eine Rolle hat oder mit einem Team teilnimmt.",
)
async def list_tournaments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await tournament_service.list_tournaments(db, current_user.id)


@router.get(
    "/{tournament_id}",
    response_model=TournamentResponse,
    summary="Turnier-Details abrufen",
)
async def get_tournament(
    tournament_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await tournament_service.get_tournament(db, tournament_id)


@router.patch(
    "/{tournament_id}",
    response_model=TournamentResponse,
    summary="Turnier bearbeiten",
    description="Aktualisiert Turnier-Details. Nur Admin oder Manager.",
)
async def update_tournament(
    tournament_id: UUID,
    body: TournamentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await role_service.require_role(db, tournament_id, current_user.id, TournamentRoleType.MANAGER)
    return await tournament_service.update_tournament(db, tournament_id, body)


@router.delete(
    "/{tournament_id}",
    status_code=204,
    summary="Turnier löschen (Soft-Delete)",
    description="Markiert ein Turnier als gelöscht. Nur Admin.",
)
async def delete_tournament(
    tournament_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await role_service.require_role(db, tournament_id, current_user.id, TournamentRoleType.ADMIN)
    await tournament_service.soft_delete_tournament(db, tournament_id)


@router.post(
    "/{tournament_id}/join",
    status_code=201,
    summary="Mit Team beitreten",
    description="Tritt einem Turnier mit einem vollständigen Team bei. "
    "Validiert Team-Vollständigkeit und prüft, ob Teammitglieder bereits im Turnier sind.",
)
async def join_tournament(
    tournament_id: UUID,
    body: TournamentJoinRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await tournament_service.join_tournament(db, tournament_id, body.team_id, current_user.id)


@router.post(
    "/{tournament_id}/start",
    response_model=BracketResponse,
    summary="Turnier starten",
    description="Generiert das KO-Bracket mit zufälliger Team-Zuordnung und Freilos-Handling. Nur Admin.",
)
async def start_tournament(
    tournament_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await role_service.require_role(db, tournament_id, current_user.id, TournamentRoleType.ADMIN)
    await bracket_service.generate_bracket(db, tournament_id)
    return await bracket_service.get_bracket(db, tournament_id)


@router.get(
    "/{tournament_id}/bracket",
    response_model=BracketResponse,
    summary="Bracket abrufen",
    description="Gibt den vollständigen Turnierbaum mit allen Matches zurück.",
)
async def get_bracket(
    tournament_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await bracket_service.get_bracket(db, tournament_id)
