from typing import Annotated
from uuid import UUID

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException

from app.core.database import DbSession
from app.core.exceptions import NotFoundError, TournamentAlreadyStartedError
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
from app.schemas.invitation import InvitationCreate, TournamentInvitationResponse
from app.services.bracket_service import BracketService
from app.services.invitation_service import InvitationService
from app.services.invite_service import InviteService, build_preview
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
    db: DbSession,
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
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    return await TournamentService(db).update_tournament(tournament_id, body)


@router.get(
    "/{tournament_id}/invites",
    response_model=list[InviteResponse],
    summary="Einladungslinks auflisten",
    description="Alle Einladungslinks des Turniers, auch gelöschte, mit der Zahl der Accounts, die sie geöffnet haben, "
    "und wie viele davon mitspielen. Nur Admin und Manager.",
)
async def list_invites(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
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
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await TournamentService(db).get_tournament(tournament_id)
    invite = await InviteService(db).create(tournament_id, current_user.id, body.label)
    await db.commit()
    return InviteService.to_response(invite)


@router.delete(
    "/{tournament_id}/invites/{invite_id}",
    status_code=204,
    summary="Einladungslink löschen",
    description="Der Link funktioniert danach nicht mehr und erscheint als gelöscht. Einladungen, die über ihn "
    "angelegt wurden, bleiben (auch offene). Nur Admin und Manager.",
)
async def delete_invite(
    tournament_id: UUID,
    invite_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await InviteService(db).delete(tournament_id, invite_id)
    await db.commit()


@router.get(
    "/{tournament_id}/invitations",
    response_model=list[TournamentInvitationResponse],
    summary="Einladungen auflisten",
    description="Alle persönlichen Einladungen: direkt oder über einen Link, mit Stand. Nur Admin und Manager.",
)
async def list_invitations(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await TournamentService(db).get_tournament(tournament_id)
    return await InvitationService(db).list_for_tournament(tournament_id)


@router.post(
    "/{tournament_id}/invitations",
    response_model=TournamentInvitationResponse,
    status_code=201,
    summary="Person einladen",
    description="Lädt eine Person direkt ein; die Einladung steht in ihrem Konto. Wer schon eingeladen ist, bleibt es "
    "(abgelehnt oder entfernt: wieder offen). Nur Admin und Manager, bis zum Start.",
)
async def invite_person(
    tournament_id: UUID,
    body: InvitationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    if (await TournamentService(db).get_tournament(tournament_id)).is_started:
        raise TournamentAlreadyStartedError()
    return await InvitationService(db).invite_user(tournament_id, body.user_id, current_user.id)


@router.delete(
    "/{tournament_id}/invitations/{invitation_id}",
    status_code=204,
    summary="Einladung entfernen",
    description="Nimmt eine offene Einladung aus dem Konto der Person. Nur Admin und Manager.",
)
async def withdraw_invitation(
    tournament_id: UUID,
    invitation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await InvitationService(db).withdraw(tournament_id, invitation_id)


@router.delete(
    "/{tournament_id}",
    status_code=204,
    summary="Turnier löschen",
    description="Löscht ein Turnier (Soft-Delete). Nur Admin.",
)
async def delete_tournament(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
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
    db: DbSession,
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
    db: DbSession,
):
    service = TournamentService(db)
    tournament = await service.get_tournament_by_slug(slug)
    try:
        return await service.get_tournament_for_user(tournament.id, viewer.id if viewer else None)
    except HTTPException:
        # a private tournament does not say that it exists
        raise NotFoundError("Turnier") from None


@router.get(
    "/by-slug/{slug}/preview",
    response_model=TournamentPreview,
    summary="Vorschau für Fremde",
    description="Name, Zeit und Ort eines Turniers, dem jeder mit Link beitreten darf, ohne Anmeldung abrufbar. "
    "Bei Turnieren, die nur mit Einladungslink offen sind, antwortet die Adresse wie eine unbekannte (404).",
)
async def get_tournament_preview(slug: str, db: DbSession):
    tournament = await TournamentService(db).get_tournament_by_slug(slug)
    if tournament.join_policy != JoinPolicy.OPEN:
        raise NotFoundError("Turnier")
    return await build_preview(db, tournament)


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
    db: DbSession,
):
    return await TournamentService(db).join_tournament(tournament_id, body.team_id, current_user.id)


@router.delete(
    "/{tournament_id}/leave",
    status_code=204,
    summary="Turnier verlassen",
    description="Zieht ein Team aus dem Turnier zurück (Nur vor Start möglich).",
)
async def leave_tournament(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
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
    db: DbSession,
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
    db: DbSession,
):
    # strangers (and everybody who is neither a player nor a helper here) see the team names, not the players
    involved = await TournamentService(db).is_involved(tournament.id, viewer.id if viewer else None)
    teams_data = await TournamentService(db).get_tournament_teams(tournament.id)
    members_by_team = await TeamService(db).get_members_with_names_for_teams([team.id for team, _, _ in teams_data])
    result = []
    for team, is_checked_in, name in teams_data:
        members = members_by_team[team.id]
        result.append(
            TournamentTeamResponse(
                id=team.id,
                name=name,
                max_size=team.max_size,
                members=[TeamMemberResponse.model_validate(m) for m in members] if involved else [],
                is_complete=len(members) >= team.max_size,
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
    db: DbSession,
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
    db: DbSession,
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
    db: DbSession,
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
    db: DbSession,
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
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    return await LifecycleService(db).start_tournament(tournament_id)


class KnockoutStart(BaseModel):
    """Where teams of a group share a place: the order the organization decided (group number -> its teams)."""
    order: dict[int, list[UUID]] = {}


@router.post(
    "/{tournament_id}/knockout",
    status_code=204,
    summary="K.-o.-Runde starten",
    description="Startet nach der Gruppenphase die K.-o.-Runde: Die Plätze im Baum bekommen ihre Teams, die "
    "Ergebnisse der Gruppen stehen danach fest. Alle Gruppenspiele brauchen ein Ergebnis; bei Gleichstand an einem "
    "Platz, der zählt, legt die Orga die Reihenfolge fest (`order`). Nur Admin und Manager.",
)
async def start_knockout(
    tournament_id: UUID,
    body: KnockoutStart,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.MANAGER)
    await BracketService(db).start_knockout(tournament_id, body.order)
