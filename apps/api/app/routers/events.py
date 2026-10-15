"""Live view: a stream of change signals per tournament (Server-Sent Events).

The stream carries no data, only "revision N, these parts changed". The browser then loads what it needs from the
normal endpoints, which decide what this viewer may see. A later event `live` (sensor state) can join the same stream.
"""
import asyncio
import json
from collections.abc import AsyncIterator
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.config import settings
from app.core.database import async_session
from app.core.events import Subscription, TooManySubscribers, bus
from app.core.security import user_from_authorization
from app.models.tournament import Tournament
from app.schemas.tournament import TournamentState
from app.services.tournament_service import TournamentService, get_accessible_tournament

router = APIRouter(prefix="/tournaments/{tournament_id}", tags=["Live"])


def format_event(name: str, data: dict[str, Any], event_id: int | None = None) -> str:
    lines = [f"event: {name}"]
    if event_id is not None:
        lines.append(f"id: {event_id}")
    lines.append(f"data: {json.dumps(data, separators=(',', ':'))}")
    return "\n".join(lines) + "\n\n"


async def event_stream(
    tournament_id: UUID,
    subscription: Subscription,
    revision: int,
    heartbeat_seconds: float,
    max_seconds: float,
) -> AsyncIterator[str]:
    """The stream body: the current revision first (a browser that missed something catches up from it), then every
    change, a comment as sign of life while nothing happens, and the end after `max_seconds`."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + max_seconds
    try:
        yield "retry: 3000\n\n"
        yield format_event("revision", {"revision": revision, "changed": ["all"]}, revision)
        while (remaining := deadline - loop.time()) > 0:
            event = await subscription.next(min(heartbeat_seconds, remaining))
            if event is None:
                yield ": ping\n\n"
            else:
                yield format_event(event.name, event.data, event.data.get("revision"))
    finally:
        bus.unsubscribe(tournament_id, subscription)


@router.get(
    "/events",
    summary="Änderungen live verfolgen",
    description="Server-Sent Events: meldet pro Änderung die neue Revision und welche Teile sich geändert haben "
    "(tournament, teams, bracket, roles). Enthält keine Daten, die lädt der Client über die normalen Endpunkte. "
    "Zugriff wie beim Lesen des Turniers (öffentlich für alle, privat nur für Beteiligte).",
    response_class=StreamingResponse,
)
async def tournament_events(tournament_id: UUID, authorization: Annotated[str | None, Header()] = None):
    # No request-long database session here (a dependency with yield would hold one for as long as the stream
    # runs): the access check uses a short one of its own.
    try:
        subscription = bus.subscribe(tournament_id, max_total=settings.sse_max_connections)
    except TooManySubscribers:
        return JSONResponse(
            {"detail": "Zu viele Live-Verbindungen. Versuche es gleich noch einmal."},
            status_code=503,
            headers={"Retry-After": "30"},
        )
    try:
        async with async_session() as db:
            viewer = await user_from_authorization(authorization, db)
            tournament = await TournamentService(db).get_tournament_for_user(tournament_id, viewer.id if viewer else None)
            revision = tournament.revision
    except BaseException:
        bus.unsubscribe(tournament_id, subscription)
        raise

    return StreamingResponse(
        event_stream(tournament_id, subscription, revision, settings.sse_heartbeat_seconds, settings.sse_max_seconds),
        media_type="text/event-stream",
        headers={
            # no-transform: no proxy or compression layer may buffer the stream
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/state",
    response_model=TournamentState,
    summary="Hat sich etwas geändert?",
    description="Nur die Revision des Turniers. Ersatz für den Live-Stream, wenn der nicht erreichbar ist.",
)
async def tournament_state(tournament: Annotated[Tournament, Depends(get_accessible_tournament)]):
    return TournamentState(revision=tournament.revision)
