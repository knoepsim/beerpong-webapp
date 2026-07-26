import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from uuid import UUID
from app.core.database import async_session
from app.schemas.tournament import TournamentUpdate
from app.services.tournament_service import update_tournament
from app.models.tournament import TournamentVisibility

async def main():
    async with async_session() as db:
        try:
            tournament_id = UUID("ef566525-4127-4b8d-8c43-1d4098c602d3")
            data = TournamentUpdate(name="testtunier2", table_count=1, visibility=TournamentVisibility.PRIVATE)
            res = await update_tournament(db, tournament_id, data)
            print("SUCCESS:", res)
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
