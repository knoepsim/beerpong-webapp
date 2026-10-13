from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import NotFoundError, ResultRequiresWinnerError
from app.core.security import get_current_user
from app.models.match import Match
from app.models.result import Result, ResultType
from app.models.tournament_role import TournamentRoleType
from app.models.user import User
from app.schemas.result import ResultCreate, ResultResponse
from app.services.bracket_service import BracketService
from app.services.role_service import RoleService

router = APIRouter(prefix="/matches/{match_id}/results", tags=["Results"])


async def _get_match(db: AsyncSession, match_id: UUID) -> Match:
    """Helper to get a match and verify it exists."""
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if match is None:
        raise NotFoundError("Match")
    return match


@router.post(
    "",
    response_model=ResultResponse,
    status_code=201,
    summary="Ergebnis melden",
    description="Meldet ein Ergebnis für ein Match. Nur Admin, Manager oder Schiedsrichter. "
    "Der Gewinner wird automatisch in das Folge-Match eingetragen.",
)
async def create_result(
    match_id: UUID,
    body: ResultCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    match = await _get_match(db, match_id)
    await RoleService(db).require_role(match.tournament_id, current_user.id, TournamentRoleType.REFEREE
    )
    return await BracketService(db).report_result(match_id, body, current_user.id)


@router.patch(
    "",
    response_model=ResultResponse,
    summary="Ergebnis korrigieren",
    description="Erstellt einen neuen MODIFIED-Eintrag im Result-Event-Log.",
)
async def modify_result(
    match_id: UUID,
    body: ResultCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    match = await _get_match(db, match_id)
    await RoleService(db).require_role(match.tournament_id, current_user.id, TournamentRoleType.REFEREE
    )

    if body.winner_team_id is None:
        raise ResultRequiresWinnerError()

    return await BracketService(db).modify_result(match_id, body, current_user.id)


@router.delete(
    "",
    response_model=ResultResponse,
    summary="Ergebnis als gelöscht markieren",
    description="Erstellt einen DELETED-Eintrag im Result-Event-Log. winner_team_id wird auf null gesetzt.",
)
async def delete_result(
    match_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    match = await _get_match(db, match_id)
    await RoleService(db).require_role(match.tournament_id, current_user.id, TournamentRoleType.REFEREE
    )

    return await BracketService(db).delete_result(match_id, current_user.id)


@router.get(
    "",
    response_model=list[ResultResponse],
    summary="Result-Event-Log abrufen",
    description="Gibt alle Result-Events für ein Match zurück (chronologisch). "
    "Das aktuelle Ergebnis ist der letzte nicht-gelöschte Eintrag.",
)
async def list_results(
    match_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_match(db, match_id)
    result = await db.execute(
        select(Result)
        .options(joinedload(Result.reported_by_user))
        .where(Result.match_id == match_id)
        .order_by(Result.created_at)
    )
    results = result.scalars().all()
    return [
        ResultResponse(
            id=r.id,
            match_id=r.match_id,
            type=r.type,
            winner_team_id=r.winner_team_id,
            cups_left=r.cups_left,
            reported_by_user_id=r.reported_by_user_id,
            reported_by_username=r.reported_by_user.name if r.reported_by_user else None,
            created_at=r.created_at
        )
        for r in results
    ]
