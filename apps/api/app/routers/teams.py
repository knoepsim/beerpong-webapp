from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import DbSession
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.team import TeamCreate, TeamInviteResponse, TeamInviteDetailsResponse, TeamResponse, TeamUpdate
from app.services.team_service import TeamService

router = APIRouter(prefix="/teams", tags=["Teams"])


@router.post(
    "",
    response_model=TeamResponse,
    status_code=201,
    summary="Team erstellen",
    description="Erstellt ein neues Team. Der erstellende User wird automatisch als erstes Mitglied hinzugefügt.",
)
async def create_team(
    body: TeamCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    team = await TeamService(db).create_team(body.name, current_user.id)
    return await TeamService(db).to_response(team)


@router.get(
    "",
    response_model=list[TeamResponse],
    summary="Eigene Teams auflisten",
    description="Gibt alle Teams zurück, in denen der authentifizierte User Mitglied ist.",
)
async def list_my_teams(
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    teams = await TeamService(db).get_user_teams(current_user.id)
    return [await TeamService(db).to_response(team) for team in teams]


@router.get(
    "/{team_id}",
    response_model=TeamResponse,
    summary="Team-Details abrufen",
    description="Gibt die Details eines Teams inklusive aller Mitglieder zurück. Nur für Teammitglieder.",
)
async def get_team(
    team_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    team = await TeamService(db).get_team(team_id)
    await _ensure_is_member(db, team_id, current_user.id)
    return await TeamService(db).to_response(team)


async def _ensure_is_member(db: AsyncSession, team_id: UUID, user_id: UUID):
    members = await TeamService(db).get_team_members(team_id)
    if not any(m.user_id == user_id for m in members):
        raise HTTPException(status_code=403, detail="Das können nur Spieler dieses Teams.")


@router.patch(
    "/{team_id}",
    response_model=TeamResponse,
    summary="Team umbenennen",
    description="Benennt ein Team um. Gestartete Turniere behalten den Namen vom Start.",
)
async def update_team(
    team_id: UUID,
    body: TeamUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    team = await TeamService(db).get_team(team_id)
    await _ensure_is_member(db, team_id, current_user.id)
    team = await TeamService(db).update_team(team.id, body.name)
    return await TeamService(db).to_response(team)


@router.delete(
    "/{team_id}",
    status_code=204,
    summary="Team löschen",
    description="Löscht ein Team (soft delete). Nicht, solange es in einem Turnier spielt oder dafür angemeldet ist "
    "(409 mit Grund); beendete Turniere behalten es.",
)
async def delete_team(
    team_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    team = await TeamService(db).get_team(team_id)
    await _ensure_is_member(db, team_id, current_user.id)
    await TeamService(db).soft_delete_team(team.id)


@router.post(
    "/{team_id}/invite",
    response_model=TeamInviteResponse,
    status_code=201,
    summary="Einladungslink generieren",
    description="Generiert einen teilbaren Einladungslink für das Team. "
    "Nur Teammitglieder können Einladungen erstellen.",
)
async def create_invite(
    team_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    return await TeamService(db).create_invite(team_id, current_user.id)


@router.get(
    "/invite/{token}",
    response_model=TeamInviteDetailsResponse,
    summary="Einladungs-Details abrufen",
    description="Gibt Team- und Einlader-Namen für einen Invite-Link zurück.",
)
async def get_invite_details(
    token: str,
    db: DbSession,
):
    details = await TeamService(db).get_invite_details(token)
    return TeamInviteDetailsResponse(**details)


@router.post(
    "/join/{token}",
    response_model=TeamResponse,
    summary="Einladung annehmen",
    description="Nimmt eine Team-Einladung an. Prüft Kapazität und invalidiert den Link bei vollem Team.",
)
async def accept_invite(
    token: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    team = await TeamService(db).accept_invite(token, current_user.id)
    return await TeamService(db).to_response(team)
