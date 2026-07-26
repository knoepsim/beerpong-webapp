from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.tournament_role import TournamentRoleType
from app.models.user import User
from app.schemas.match import BracketResponse
from app.schemas.tournament import (
    MyTournamentsResponse,
    TournamentCreate,
    TournamentJoinRequest,
    TournamentResponse,
    TournamentUpdate,
)
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
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await tournament_service.create_tournament(db, body, current_user.id)


@router.patch(
    "/{tournament_id}",
    response_model=TournamentResponse,
    summary="Turnier bearbeiten",
    description="Bearbeitet ein Turnier. Nur Admin und Manager.",
)
async def update_tournament(
    tournament_id: UUID,
    body: TournamentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await role_service.require_role(db, tournament_id, current_user.id, TournamentRoleType.MANAGER)
    return await tournament_service.update_tournament(db, tournament_id, body)


@router.delete(
    "/{tournament_id}",
    status_code=204,
    summary="Turnier löschen",
    description="Löscht ein Turnier (Soft-Delete). Nur Admin.",
)
async def delete_tournament(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await role_service.require_role(db, tournament_id, current_user.id, TournamentRoleType.ADMIN)
    await tournament_service.delete_tournament(db, tournament_id)

@router.get(
    "/me",
    response_model=MyTournamentsResponse,
    summary="Meine Turniere abrufen",
    description="Gibt Turniere zurück, aufgeteilt in teilnehmend (mit Team) und verwaltend (mit Rolle).",
)
async def get_my_tournaments(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await tournament_service.get_my_tournaments(db, current_user.id)


@router.get(
    "",
    response_model=list[TournamentResponse],
    summary="Turniere auflisten",
    description="Listet alle öffentlich gelisteten Turniere sowie Turniere, "
    "in denen der User eine Rolle hat oder mit einem Team teilnimmt.",
)
async def list_tournaments(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await tournament_service.list_tournaments(db, current_user.id)


@router.get(
    "/{tournament_id}",
    response_model=TournamentResponse,
    summary="Turnier-Details abrufen",
)
async def get_tournament(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await tournament_service.get_tournament(db, tournament_id)

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
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await tournament_service.join_tournament(db, tournament_id, body.team_id)


@router.delete(
    "/{tournament_id}/leave",
    status_code=204,
    summary="Turnier verlassen",
    description="Zieht ein Team aus dem Turnier zurück (Nur vor Start möglich).",
)
async def leave_tournament(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await tournament_service.leave_tournament(db, tournament_id, current_user.id)


@router.post(
    "/{tournament_id}/start",
    response_model=BracketResponse,
    summary="Turnier starten",
    description="Generiert das KO-Bracket mit zufälliger Team-Zuordnung und Freilos-Handling. Nur Admin.",
)
async def start_tournament(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
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
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await bracket_service.get_bracket(db, tournament_id)


from app.schemas.team import TeamResponse, TeamMemberResponse

@router.get(
    "/{tournament_id}/teams",
    response_model=list[TeamResponse],
    summary="Turnier-Teams abrufen",
    description="Gibt alle Teams zurück, die an diesem Turnier teilnehmen.",
)
async def get_teams(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.services import team_service
    teams = await tournament_service.get_tournament_teams(db, tournament_id)
    result = []
    for team in teams:
        members = await team_service.get_team_members_with_names(db, team.id)
        is_deletable, is_renamable = await team_service.get_team_flags(db, team.id)
        result.append(
            TeamResponse(
                id=team.id,
                name=team.name,
                max_size=team.max_size,
                members=[TeamMemberResponse.model_validate(m) for m in members],
                is_complete=len(members) >= team.max_size,
                is_deletable=is_deletable,
                is_renamable=is_renamable,
                created_at=team.created_at,
            )
        )
    return result


@router.delete(
    "/{tournament_id}/teams/{team_id}",
    status_code=204,
    summary="Team aus Turnier entfernen",
    description="Entfernt ein Team aus dem Turnier. Nur für Admins und Manager.",
)
async def remove_team_from_tournament(
    tournament_id: UUID,
    team_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _check_manage_permission(db, tournament_id, current_user.id)
    await tournament_service.remove_team(db, tournament_id, team_id)
    await db.commit()
