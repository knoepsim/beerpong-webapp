with open('apps/api/app/services/tournament_service.py', 'a', encoding='utf-8') as f:
    f.write('''
    async def start_tournament(self, tournament_id: UUID) -> None:
        from datetime import datetime, timezone
        from sqlalchemy import select
        from app.models.match import Match
        from fastapi import HTTPException
        
        tournament = await self.get_tournament(tournament_id)
        if tournament.started_at is not None:
            raise HTTPException(status_code=400, detail="Tournament is already started.")
            
        res = await self.db.execute(select(Match).where(Match.tournament_id == tournament_id))
        if not res.scalars().first():
            raise HTTPException(status_code=400, detail="Cannot start tournament without a bracket.")
            
        tournament.started_at = datetime.now(timezone.utc)
''')

with open('apps/api/app/routers/tournaments.py', 'a', encoding='utf-8') as f:
    f.write('''
@router.post(
    "/{tournament_id}/start",
    status_code=204,
    summary="Turnier starten",
    description="Setzt den Status auf gestartet. Nur Admin.",
)
async def start_tournament(
    tournament_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RoleService(db).require_role(tournament_id, current_user.id, TournamentRoleType.ADMIN)
    await TournamentService(db).start_tournament(tournament_id)
    await db.commit()
''')
