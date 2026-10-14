from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.tournament import TournamentPreview
from app.services.invite_service import InviteService

router = APIRouter(prefix="/invites", tags=["Invites"])


@router.get(
    "/{token}",
    response_model=TournamentPreview,
    summary="Einladungslink öffnen",
    description="Name, Zeit und Ort des Turniers hinter einem Einladungslink, ohne Anmeldung abrufbar. "
    "Unbekannte und gelöschte Links antworten gleich (404).",
)
async def open_invite(token: str, db: Annotated[AsyncSession, Depends(get_db)]):
    return await InviteService(db).preview(token)
