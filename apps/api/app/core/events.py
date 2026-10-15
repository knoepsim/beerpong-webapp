"""In-process fan-out of change signals to the browsers that watch a tournament (Server-Sent Events).

Events are signals, not data: "tournament X is now at revision N and these parts changed". The browser then asks
the normal (access checked) endpoints for what it needs. A subscriber keeps only the latest pending event per
name, so a slow connection never builds a backlog and bursts of changes arrive as one.

The bus lives in the memory of one process. With several API processes a shared channel (Postgres
LISTEN/NOTIFY, Redis) has to feed `publish`; nothing else changes.
"""
import asyncio
from collections import defaultdict
from dataclasses import dataclass
from typing import Any
from uuid import UUID


class TooManySubscribers(Exception):
    pass


@dataclass(frozen=True)
class Event:
    name: str
    data: dict[str, Any]


def _merge(name: str, old: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    """Two pending events of the same name become one. Unknown names: the newest wins (a state, not a change)."""
    if name == "revision":
        return {
            "revision": max(old["revision"], new["revision"]),
            "changed": sorted(set(old["changed"]) | set(new["changed"])),
        }
    return new


class Subscription:
    def __init__(self) -> None:
        self._pending: dict[str, dict[str, Any]] = {}
        self._ready = asyncio.Event()

    def push(self, event: Event) -> None:
        old = self._pending.get(event.name)
        self._pending[event.name] = _merge(event.name, old, event.data) if old is not None else event.data
        self._ready.set()

    async def next(self, timeout: float) -> Event | None:
        """The next event, or None if nothing happened within `timeout` seconds."""
        try:
            await asyncio.wait_for(self._ready.wait(), timeout)
        except TimeoutError:
            return None
        name = next(iter(self._pending))
        data = self._pending.pop(name)
        if not self._pending:
            self._ready.clear()
        return Event(name, data)


class EventBus:
    def __init__(self) -> None:
        self._subscriptions: dict[UUID, set[Subscription]] = defaultdict(set)
        self._count = 0

    @property
    def count(self) -> int:
        return self._count

    def subscribe(self, tournament_id: UUID, *, max_total: int) -> Subscription:
        if self._count >= max_total:
            raise TooManySubscribers()
        subscription = Subscription()
        self._subscriptions[tournament_id].add(subscription)
        self._count += 1
        return subscription

    def unsubscribe(self, tournament_id: UUID, subscription: Subscription) -> None:
        subscriptions = self._subscriptions.get(tournament_id)
        if subscriptions and subscription in subscriptions:
            subscriptions.discard(subscription)
            self._count -= 1
            if not subscriptions:
                del self._subscriptions[tournament_id]

    def publish(self, tournament_id: UUID, name: str, data: dict[str, Any]) -> None:
        for subscription in list(self._subscriptions.get(tournament_id, ())):
            subscription.push(Event(name, data))


bus = EventBus()
