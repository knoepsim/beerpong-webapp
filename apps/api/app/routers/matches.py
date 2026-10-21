from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import DbSession
from app.core.security import get_current_user
from app.models.tournament_role import TournamentRoleType
from app.models.user import User
from app.routers.results import _get_match
from app.services.bracket_service import BracketService
from app.services.role_service import RoleService

router = APIRouter(prefix="/matches/{match_id}", tags=["Matches"])


async def _set_started(match_id: UUID, started: bool, user: User, db: AsyncSession) -> None:
    match = await _get_match(db, match_id)
    await RoleService(db).require_role(match.tournament_id, user.id, TournamentRoleType.REFEREE)
    await BracketService(db).set_started(match_id, started)


@router.post(
    "/start",
    status_code=204,
    summary="Spiel starten",
    description="Startet ein Spiel an seiner Spielstätte (live). Nur Admin, Manager oder Schiedsrichter. "
    "Ein Ergebnis kann auch ohne Start gemeldet werden.",
)
async def start_match(
    match_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await _set_started(match_id, True, current_user, db)


@router.delete(
    "/start",
    status_code=204,
    summary="Start zurücknehmen",
    description="Das Spiel ist wieder bereit an seiner Spielstätte, aber nicht gestartet.",
)
async def undo_start(
    match_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await _set_started(match_id, False, current_user, db)
