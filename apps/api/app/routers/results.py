from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import NotFoundError, ResultRequiresWinnerError
from app.core.security import get_current_user
from app.models.match import Match
from app.models.result import Result, ResultType
from app.models.tournament_role import TournamentRoleType
from app.models.user import User
from app.schemas.result import ResultCreate, ResultResponse
from app.services import bracket_service, role_service

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
    await role_service.require_role(
        db, match.tournament_id, current_user.id, TournamentRoleType.REFEREE
    )
    return await bracket_service.report_result(db, match_id, body, current_user.id)


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
    await role_service.require_role(
        db, match.tournament_id, current_user.id, TournamentRoleType.REFEREE
    )

    if body.winner_team_id is None:
        raise ResultRequiresWinnerError()

    result_entry = Result(
        match_id=match_id,
        type=ResultType.MODIFIED,
        winner_team_id=body.winner_team_id,
        cups_left=body.cups_left,
        reported_by_user_id=current_user.id,
    )
    db.add(result_entry)
    return result_entry


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
    await role_service.require_role(
        db, match.tournament_id, current_user.id, TournamentRoleType.REFEREE
    )

    result_entry = Result(
        match_id=match_id,
        type=ResultType.DELETED,
        winner_team_id=None,
        cups_left=None,
        reported_by_user_id=current_user.id,
    )
    db.add(result_entry)
    return result_entry


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
        .where(Result.match_id == match_id)
        .order_by(Result.created_at)
    )
    return list(result.scalars().all())
