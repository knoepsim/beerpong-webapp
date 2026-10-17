from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.database import DbSession
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.invitation import InvitationAccept, InvitationResponse
from app.services.invitation_service import InvitationService

router = APIRouter(prefix="/invitations", tags=["Invitations"])

CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get(
    "",
    response_model=list[InvitationResponse],
    summary="Meine offenen Einladungen",
    description="Offene Einladungen zu Turnieren, denen man noch beitreten kann.",
)
async def list_my_invitations(current_user: CurrentUser, db: DbSession):
    return await InvitationService(db).list_mine(current_user.id)


@router.get(
    "/{invitation_id}",
    response_model=InvitationResponse,
    summary="Einladung ansehen",
    description="Eine eigene Einladung mit dem Turnier, wer eingeladen hat und dem Stand.",
)
async def get_invitation(invitation_id: UUID, current_user: CurrentUser, db: DbSession):
    return await InvitationService(db).get_mine(invitation_id, current_user.id)


@router.post(
    "/{invitation_id}/accept",
    response_model=InvitationResponse,
    summary="Einladung annehmen",
    description="Tritt dem Turnier mit dem gewählten (vollständigen) Team bei; es gelten dieselben Regeln wie beim "
    "Beitreten, die Einladung ersetzt den Einladungslink.",
)
async def accept_invitation(invitation_id: UUID, body: InvitationAccept, current_user: CurrentUser, db: DbSession):
    return await InvitationService(db).accept(invitation_id, current_user.id, body.team_id)


@router.post(
    "/{invitation_id}/decline",
    response_model=InvitationResponse,
    summary="Einladung ablehnen",
)
async def decline_invitation(invitation_id: UUID, current_user: CurrentUser, db: DbSession):
    return await InvitationService(db).decline(invitation_id, current_user.id)


@router.post(
    "/{invitation_id}/reopen",
    response_model=InvitationResponse,
    summary="Ablehnen rückgängig machen",
)
async def reopen_invitation(invitation_id: UUID, current_user: CurrentUser, db: DbSession):
    return await InvitationService(db).undo_decline(invitation_id, current_user.id)
