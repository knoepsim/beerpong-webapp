import re
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    InvalidTableNameError,
    LastTableError,
    NotFoundError,
    TableNameTakenError,
    TooManyTablesError,
)
from app.models.tournament_table import TournamentTable

MAX_TABLES = 100
MAX_NAME_LENGTH = 40
_DEFAULT_NAME = re.compile(r"^Tisch (\d+)$")


def normalize_table_name(name: str) -> str:
    cleaned = " ".join(name.split())
    if not cleaned:
        raise InvalidTableNameError("Der Name darf nicht leer sein.")
    if len(cleaned) > MAX_NAME_LENGTH:
        raise InvalidTableNameError(f"Der Name darf höchstens {MAX_NAME_LENGTH} Zeichen lang sein.")
    return cleaned


def next_default_name(names: list[str]) -> str:
    """"Tisch {n}" with n one above the highest "Tisch n" there is: the names keep ascending, also after deleting."""
    numbers = [int(match.group(1)) for name in names if (match := _DEFAULT_NAME.match(name))]
    return f"Tisch {max(numbers, default=0) + 1}"


class TableService:
    """The tables of a tournament: created with it, then added, renamed and deleted by the organizers."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_tables(self, tournament_id: UUID) -> list[TournamentTable]:
        result = await self.db.execute(
            select(TournamentTable)
            .where(TournamentTable.tournament_id == tournament_id)
            .order_by(TournamentTable.position)
        )
        return list(result.scalars().all())

    async def create_default_tables(self, tournament_id: UUID, count: int) -> list[TournamentTable]:
        tables = [TournamentTable(tournament_id=tournament_id, name=f"Tisch {n}", position=n) for n in range(1, count + 1)]
        self.db.add_all(tables)
        await self.db.flush()
        return tables

    async def add(self, tournament_id: UUID, name: str | None = None) -> TournamentTable:
        tables = await self.list_tables(tournament_id)
        if len(tables) >= MAX_TABLES:
            raise TooManyTablesError(MAX_TABLES)
        names = [t.name for t in tables]
        chosen = normalize_table_name(name) if name and name.strip() else next_default_name(names)
        self._ensure_free(chosen, names)
        table = TournamentTable(
            tournament_id=tournament_id,
            name=chosen,
            position=max((t.position for t in tables), default=0) + 1,
        )
        self.db.add(table)
        await self.db.flush()
        await self._changed(tournament_id)
        return table

    async def rename(self, tournament_id: UUID, table_id: UUID, name: str) -> TournamentTable:
        table = await self._get(tournament_id, table_id)
        chosen = normalize_table_name(name)
        others = [t.name for t in await self.list_tables(tournament_id) if t.id != table_id]
        self._ensure_free(chosen, others)
        table.name = chosen
        await self.db.flush()
        await self._changed(tournament_id, replan=False)
        return table

    async def delete(self, tournament_id: UUID, table_id: UUID) -> None:
        table = await self._get(tournament_id, table_id)
        count = (
            await self.db.execute(
                select(func.count()).select_from(TournamentTable).where(TournamentTable.tournament_id == tournament_id)
            )
        ).scalar_one()
        if count <= 1:
            raise LastTableError()
        await self.db.delete(table)
        await self.db.flush()
        await self._changed(tournament_id)

    async def _changed(self, tournament_id: UUID, replan: bool = True) -> None:
        """Every change of the tables is shown live; a table more or less also changes who plays where (once started)."""
        # imported here: the bracket uses the tables
        from app.services.bracket_service import BracketService
        from app.services.revision import bump
        from app.services.tournament_service import TournamentService

        tournament = await TournamentService(self.db).get_tournament(tournament_id, for_update=True)
        if replan and tournament.is_started:
            await BracketService(self.db).assign_tables(tournament_id)
        await bump(self.db, tournament_id, "bracket")

    async def _get(self, tournament_id: UUID, table_id: UUID) -> TournamentTable:
        result = await self.db.execute(
            select(TournamentTable).where(TournamentTable.id == table_id, TournamentTable.tournament_id == tournament_id)
        )
        table = result.scalar_one_or_none()
        if table is None:
            raise NotFoundError("Tisch")
        return table

    @staticmethod
    def _ensure_free(name: str, existing: list[str]) -> None:
        if name.casefold() in {n.casefold() for n in existing}:
            raise TableNameTakenError()
