from typing import Annotated
from uuid import UUID

from pydantic import BaseModel
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
    TournamentInviteResponse,
)
from app.services.bracket_service import BracketService
from app.services.role_service import RoleService
from app.services.team_service import TeamService
from app.services.tournament_service import TournamentService

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
    return await TournamentService(db).create_tournament(body, current_user.id)


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
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    return await TournamentService(db).update_tournament(tournament_id, body)


@router.delete(
    "/{tournament_id}/roles/{role_id}",
    status_code=204,
    summary="Rolle entziehen",
    description="Entfernt eine Rolle von einem User. Erfordert hierarchische Berechtigung.",
)
async def remove_role(
    tournament_id: UUID,
    role_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RoleService(db).remove_role(tournament_id, role_id, current_user.id)


@router.post(
    "/{tournament_id}/invite",
    response_model=TournamentInviteResponse,
    status_code=201,
    summary="Einladungslink generieren",
    description="Generiert ein neues Einladungs-Token für das Turnier. Nur für Manager/Admin.",
)
async def generate_invite_token(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    token = await TournamentService(db).generate_invite_token(tournament_id)
    return TournamentInviteResponse(token=token)


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
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.ADMIN)
    await TournamentService(db).delete_tournament(tournament_id)


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
    return await TournamentService(db).get_my_tournaments(current_user.id)


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
    return await TournamentService(db).list_tournaments(current_user.id)


@router.get(
    "/{tournament_id}",
    response_model=TournamentResponse,
    summary="Turnier-Details abrufen",
)
async def get_tournament(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    invite: str | None = None,
):
    return await TournamentService(db).get_tournament_for_user(tournament_id, current_user.id, invite)

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
    return await TournamentService(db).join_tournament(tournament_id, body.team_id, body.invite_token)


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
    await TournamentService(db).leave_tournament(tournament_id, current_user.id)


@router.post(
    "/{tournament_id}/generate-bracket",
    response_model=BracketResponse,
    summary="Turnier starten",
    description="Generiert das KO-Bracket mit zufälliger Team-Zuordnung und Freilos-Handling. Nur Admin.",
)
async def start_tournament(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.ADMIN)
    await BracketService(db).generate_bracket(tournament_id)
    return await BracketService(db).get_bracket(tournament_id)


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
    return await BracketService(db).get_bracket(tournament_id)


from app.schemas.team import TournamentTeamResponse, TeamMemberResponse

@router.get(
    "/{tournament_id}/teams",
    response_model=list[TournamentTeamResponse],
    summary="Turnier-Teams abrufen",
    description="Gibt alle Teams zurück, die an diesem Turnier teilnehmen.",
)
async def get_teams(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.services import team_service
    teams_data = await TournamentService(db).get_tournament_teams(tournament_id)
    result = []
    for team, is_checked_in in teams_data:
        members = await TeamService(db).get_team_members_with_names(team.id)
        is_deletable, is_renamable = await TeamService(db).get_team_flags(team.id)
        result.append(
            TournamentTeamResponse(
                id=team.id,
                name=team.name,
                max_size=team.max_size,
                members=[TeamMemberResponse.model_validate(m) for m in members],
                is_complete=len(members) >= team.max_size,
                is_deletable=is_deletable,
                is_renamable=is_renamable,
                is_checked_in=is_checked_in,
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
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await TournamentService(db).remove_team(tournament_id, team_id)
    await db.commit()

class CheckinRequest(BaseModel):
    is_checked_in: bool

@router.post(
    "/{tournament_id}/teams/{team_id}/checkin",
    status_code=204,
    summary="Team Check-in",
    description="Setzt den Check-in Status eines Teams für das Turnier. Nur für Admins und Manager.",
)
async def checkin_team(
    tournament_id: UUID,
    team_id: UUID,
    body: CheckinRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await TournamentService(db).checkin_team(tournament_id, team_id, body.is_checked_in)
    await db.commit()

@router.post(
    "/{tournament_id}/start",
    status_code=204,
    summary="Turnier starten",
    description="Setzt den Status auf gestartet. Nur Admin.",
)
async def start_tournament(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.ADMIN)
    await TournamentService(db).start_tournament(tournament_id)
    await db.commit()
