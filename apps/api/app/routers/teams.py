from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.team import TeamCreate, TeamInviteResponse, TeamMemberResponse, TeamResponse
from app.services import team_service

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
    db: Annotated[AsyncSession, Depends(get_db)],
):
    team = await team_service.create_team(db, body.name, current_user.id)
    members = await team_service.get_team_members(db, team.id)
    return TeamResponse(
        id=team.id,
        name=team.name,
        max_size=team.max_size,
        members=[TeamMemberResponse.model_validate(m) for m in members],
        is_complete=len(members) >= team.max_size,
        created_at=team.created_at,
    )


@router.get(
    "",
    response_model=list[TeamResponse],
    summary="Eigene Teams auflisten",
    description="Gibt alle Teams zurück, in denen der authentifizierte User Mitglied ist.",
)
async def list_my_teams(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    teams = await team_service.get_user_teams(db, current_user.id)
    result = []
    for team in teams:
        members = await team_service.get_team_members(db, team.id)
        result.append(
            TeamResponse(
                id=team.id,
                name=team.name,
                max_size=team.max_size,
                members=[TeamMemberResponse.model_validate(m) for m in members],
                is_complete=len(members) >= team.max_size,
                created_at=team.created_at,
            )
        )
    return result


@router.get(
    "/{team_id}",
    response_model=TeamResponse,
    summary="Team-Details abrufen",
    description="Gibt die Details eines Teams inklusive aller Mitglieder zurück.",
)
async def get_team(
    team_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    team = await team_service.get_team(db, team_id)
    members = await team_service.get_team_members(db, team.id)
    return TeamResponse(
        id=team.id,
        name=team.name,
        max_size=team.max_size,
        members=[TeamMemberResponse.model_validate(m) for m in members],
        is_complete=len(members) >= team.max_size,
        created_at=team.created_at,
    )


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
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await team_service.create_invite(db, team_id, current_user.id)


@router.post(
    "/join/{token}",
    response_model=TeamResponse,
    summary="Einladung annehmen",
    description="Nimmt eine Team-Einladung an. Prüft Kapazität und invalidiert den Link bei vollem Team.",
)
async def accept_invite(
    token: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    team = await team_service.accept_invite(db, token, current_user.id)
    members = await team_service.get_team_members(db, team.id)
    return TeamResponse(
        id=team.id,
        name=team.name,
        max_size=team.max_size,
        members=[TeamMemberResponse.model_validate(m) for m in members],
        is_complete=len(members) >= team.max_size,
        created_at=team.created_at,
    )
