from typing import Annotated
from uuid import UUID

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.security import get_current_user, get_optional_user
from app.models.tournament import JoinPolicy, Tournament
from app.models.tournament_role import TournamentRoleType
from app.models.user import User
from app.schemas.match import BracketResponse
from app.schemas.tournament import (
    MyTournamentsResponse,
    TournamentCreate,
    TournamentJoinRequest,
    TournamentResponse,
    TournamentStartResponse,
    TournamentUpdate,
    InviteCreate,
    InviteResponse,
    TournamentPreview,
)
from app.services.bracket_service import BracketService
from app.services.invite_service import InviteService, preview_of
from app.services.lifecycle_service import LifecycleService
from app.services.role_service import RoleService
from app.services.team_service import TeamService
from app.services.tournament_service import TournamentService, get_accessible_tournament

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


@router.get(
    "/{tournament_id}/invites",
    response_model=list[InviteResponse],
    summary="Einladungslinks auflisten",
    description="Alle Einladungslinks des Turniers mit der Zahl der Teams, die darüber beigetreten sind. "
    "Nur Admin und Manager.",
)
async def list_invites(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await TournamentService(db).get_tournament(tournament_id)
    return await InviteService(db).list(tournament_id)


@router.post(
    "/{tournament_id}/invites",
    response_model=InviteResponse,
    status_code=201,
    summary="Einladungslink erstellen",
    description="Erstellt einen neuen Einladungslink /invite/{token}, optional mit Namen. Nur Admin und Manager.",
)
async def create_invite(
    tournament_id: UUID,
    body: InviteCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await TournamentService(db).get_tournament(tournament_id)
    invite = await InviteService(db).create(tournament_id, current_user.id, body.label)
    await db.commit()
    return InviteResponse(id=invite.id, token=invite.token, label=invite.label, created_at=invite.created_at, uses=0)


@router.delete(
    "/{tournament_id}/invites/{invite_id}",
    status_code=204,
    summary="Einladungslink löschen",
    description="Löscht einen Einladungslink. Teams, die darüber schon beigetreten sind, bleiben im Turnier. "
    "Nur Admin und Manager.",
)
async def delete_invite(
    tournament_id: UUID,
    invite_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await InviteService(db).delete(tournament_id, invite_id)
    await db.commit()


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
    "/by-slug/{slug}",
    response_model=TournamentResponse,
    summary="Turnier über seine Adresse abrufen",
    description="Löst die Adresse /t/{slug} auf. Unbekannte und gelöschte Adressen antworten gleich (404).",
)
async def get_tournament_by_slug(
    slug: str,
    viewer: Annotated[User | None, Depends(get_optional_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = TournamentService(db)
    tournament = await service.get_tournament_by_slug(slug)
    try:
        return await service.get_tournament_for_user(tournament.id, viewer.id if viewer else None)
    except HTTPException:
        # a private tournament does not say that it exists
        raise NotFoundError("Tournament") from None


@router.get(
    "/by-slug/{slug}/preview",
    response_model=TournamentPreview,
    summary="Vorschau für Fremde",
    description="Name, Zeit und Ort eines Turniers, dem jeder mit Link beitreten darf, ohne Anmeldung abrufbar. "
    "Bei Turnieren, die nur mit Einladungslink offen sind, antwortet die Adresse wie eine unbekannte (404).",
)
async def get_tournament_preview(slug: str, db: Annotated[AsyncSession, Depends(get_db)]):
    tournament = await TournamentService(db).get_tournament_by_slug(slug)
    if tournament.join_policy != JoinPolicy.OPEN:
        raise NotFoundError("Tournament")
    return preview_of(tournament)


@router.get(
    "/{tournament_id}",
    response_model=TournamentResponse,
    summary="Turnier-Details abrufen",
)
async def get_tournament(tournament: Annotated[Tournament, Depends(get_accessible_tournament)]):
    return tournament

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


@router.get(
    "/{tournament_id}/bracket",
    response_model=BracketResponse,
    summary="Bracket abrufen",
    description="Gibt den vollständigen Turnierbaum mit allen Matches zurück.",
)
async def get_bracket(
    tournament: Annotated[Tournament, Depends(get_accessible_tournament)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await BracketService(db).get_bracket(tournament.id)


from app.schemas.team import TournamentTeamResponse, TeamMemberResponse

@router.get(
    "/{tournament_id}/teams",
    response_model=list[TournamentTeamResponse],
    summary="Turnier-Teams abrufen",
    description="Gibt alle Teams zurück, die an diesem Turnier teilnehmen.",
)
async def get_teams(
    tournament: Annotated[Tournament, Depends(get_accessible_tournament)],
    viewer: Annotated[User | None, Depends(get_optional_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # strangers (and everybody who is neither a player nor a helper here) see the team names, not the players
    involved = await TournamentService(db).is_involved(tournament.id, viewer.id if viewer else None)
    teams_data = await TournamentService(db).get_tournament_teams(tournament.id)
    result = []
    for team, is_checked_in in teams_data:
        members = await TeamService(db).get_team_members_with_names(team.id)
        is_deletable, is_renamable = await TeamService(db).get_team_flags(team.id)
        result.append(
            TournamentTeamResponse(
                id=team.id,
                name=team.name,
                max_size=team.max_size,
                members=[TeamMemberResponse.model_validate(m) for m in members] if involved else [],
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


class OpenRequest(BaseModel):
    open: bool

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

@router.put(
    "/{tournament_id}/registration",
    status_code=204,
    summary="Anmeldung öffnen/schließen",
    description="Öffnet oder schließt die Anmeldung von Hand, jederzeit vor dem Start. Unabhängig vom Check-in. "
    "Nur Admin und Manager.",
)
async def set_registration(
    tournament_id: UUID,
    body: OpenRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await LifecycleService(db).set_registration_open(tournament_id, body.open)
    await db.commit()


@router.put(
    "/{tournament_id}/checkin",
    status_code=204,
    summary="Check-in öffnen/schließen",
    description="Öffnet oder schließt den Check-in von Hand, jederzeit vor dem Start. Unabhängig von der Anmeldung. "
    "Nur Admin und Manager.",
)
async def set_checkin(
    tournament_id: UUID,
    body: OpenRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await LifecycleService(db).set_checkin_open(tournament_id, body.open)
    await db.commit()


@router.post(
    "/{tournament_id}/start",
    response_model=TournamentStartResponse,
    summary="Turnier starten",
    description="Startet das Turnier in einem Schritt. Mit Check-in spielen nur eingecheckte Teams, alle anderen "
    "werden entfernt; ohne Check-in spielen alle angemeldeten Teams. Aus den spielenden Teams wird der "
    "K.-o.-Baum ausgelost. Nur Admin und Manager.",
)
async def start_tournament(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    return await LifecycleService(db).start_tournament(tournament_id)
