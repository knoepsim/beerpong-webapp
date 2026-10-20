import re
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    InvalidStationNameError,
    LastStationError,
    NotFoundError,
    StationNameTakenError,
    TooManyStationsError,
)
from app.games import StationTerms, stations_of
from app.models.station import Station
from app.models.tournament import Tournament

MAX_STATIONS = 100
MAX_NAME_LENGTH = 40


def normalize_station_name(name: str) -> str:
    cleaned = " ".join(name.split())
    if not cleaned:
        raise InvalidStationNameError("Der Name darf nicht leer sein.")
    if len(cleaned) > MAX_NAME_LENGTH:
        raise InvalidStationNameError(f"Der Name darf höchstens {MAX_NAME_LENGTH} Zeichen lang sein.")
    return cleaned


def _default_number(name: str, terms: StationTerms) -> int | None:
    """3 for "Tisch 3" (a default name of the game), None for any other name."""
    match = re.fullmatch(rf"{re.escape(terms.singular)} (\d+)", name)
    return int(match.group(1)) if match else None


def next_default_name(names: list[str], terms: StationTerms) -> str:
    """"Tisch {n}" with n one above the highest "Tisch n" there is: the names keep ascending, also after deleting."""
    numbers = [n for name in names if (n := _default_number(name, terms)) is not None]
    return terms.numbered(max(numbers, default=0) + 1)


class StationService:
    """The stations of a tournament: created with it, then added, renamed and deleted by the organizers."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_stations(self, tournament_id: UUID) -> list[Station]:
        result = await self.db.execute(
            select(Station)
            .where(Station.tournament_id == tournament_id)
            .order_by(Station.position)
        )
        return list(result.scalars().all())

    async def _terms(self, tournament_id: UUID) -> StationTerms:
        game = (await self.db.execute(select(Tournament.game).where(Tournament.id == tournament_id))).scalar_one()
        return stations_of(game)

    async def create_default_stations(self, tournament_id: UUID, count: int, terms: StationTerms) -> list[Station]:
        stations = [Station(tournament_id=tournament_id, name=terms.numbered(n), position=n) for n in range(1, count + 1)]
        self.db.add_all(stations)
        await self.db.flush()
        return stations

    async def add(self, tournament_id: UUID, name: str | None = None) -> Station:
        terms = await self._terms(tournament_id)
        stations = await self.list_stations(tournament_id)
        if len(stations) >= MAX_STATIONS:
            raise TooManyStationsError(MAX_STATIONS, terms.plural)
        names = [t.name for t in stations]
        chosen = normalize_station_name(name) if name and name.strip() else next_default_name(names, terms)
        self._ensure_free(chosen, names, terms)
        station = Station(
            tournament_id=tournament_id,
            name=chosen,
            position=max((t.position for t in stations), default=0) + 1,
        )
        self.db.add(station)
        await self.db.flush()
        await self._changed(tournament_id)
        return station

    async def rename(self, tournament_id: UUID, station_id: UUID, name: str) -> Station:
        terms = await self._terms(tournament_id)
        station = await self._get(tournament_id, station_id, terms)
        chosen = normalize_station_name(name)
        others = [t.name for t in await self.list_stations(tournament_id) if t.id != station_id]
        self._ensure_free(chosen, others, terms)
        station.name = chosen
        await self.db.flush()
        await self._changed(tournament_id, replan=False)
        return station

    async def delete(self, tournament_id: UUID, station_id: UUID) -> None:
        terms = await self._terms(tournament_id)
        station = await self._get(tournament_id, station_id, terms)
        count = (
            await self.db.execute(
                select(func.count()).select_from(Station).where(Station.tournament_id == tournament_id)
            )
        ).scalar_one()
        if count <= 1:
            raise LastStationError(terms.accusative)
        await self.db.delete(station)
        await self.db.flush()
        await self._changed(tournament_id)

    async def _changed(self, tournament_id: UUID, replan: bool = True) -> None:
        """Every change of the stations is shown live; a station more or less also changes who plays where (once started)."""
        # imported here: the bracket uses the stations
        from app.services.bracket_service import BracketService
        from app.services.revision import bump
        from app.services.tournament_service import TournamentService

        tournament = await TournamentService(self.db).get_tournament(tournament_id, for_update=True)
        if replan and tournament.is_started:
            await BracketService(self.db).assign_stations(tournament_id)
        await bump(self.db, tournament_id, "bracket")

    async def rename_defaults(self, tournament_id: UUID, old: StationTerms, new: StationTerms) -> None:
        """Another game, other words: "Tisch 3" becomes "Platz 3"; names the organizers gave stay."""
        for station in await self.list_stations(tournament_id):
            if (n := _default_number(station.name, old)) is not None:
                station.name = new.numbered(n)
        await self.db.flush()

    async def _get(self, tournament_id: UUID, station_id: UUID, terms: StationTerms) -> Station:
        result = await self.db.execute(
            select(Station).where(Station.id == station_id, Station.tournament_id == tournament_id)
        )
        station = result.scalar_one_or_none()
        if station is None:
            raise NotFoundError(terms.singular)
        return station

    @staticmethod
    def _ensure_free(name: str, existing: list[str], terms: StationTerms) -> None:
        if name.casefold() in {n.casefold() for n in existing}:
            raise StationNameTakenError(terms.accusative)
