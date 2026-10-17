from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.database import DbSession
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.invitation import InvitationResponse
from app.schemas.tournament import TournamentPreview
from app.services.invitation_service import InvitationService
from app.services.invite_service import InviteService

router = APIRouter(prefix="/invites", tags=["Invites"])


@router.get(
    "/{token}",
    response_model=TournamentPreview,
    summary="Einladungslink öffnen",
    description="Das Turnier hinter einem Einladungslink, ohne Anmeldung abrufbar. "
    "Unbekannte und gelöschte Links antworten gleich (404).",
)
async def open_invite(token: str, db: DbSession):
    return await InviteService(db).preview(token)


@router.post(
    "/{token}/accept",
    response_model=InvitationResponse,
    summary="Einladung aus dem Link übernehmen",
    description="Legt die Einladung im Konto an (oder öffnet eine abgelehnte wieder): Sie steht danach unter "
    "Meine Turniere, auch ohne den Link. Wer schon mitspielt, bekommt sie als angenommen.",
)
async def accept_invite_link(
    token: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
):
    return await InvitationService(db).open_link(token, current_user.id)
