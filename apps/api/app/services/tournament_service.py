from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, func, select

from app.games import GAMES, stations_of
from app.core.exceptions import (
    InvalidModeError,
    NotFoundError,
    PlayerAlreadyInTournamentError,
    CheckinDisabledError,
    CheckinNotOpenError,
    InviteRequiredError,
    RegistrationClosedError,
    SlugTakenError,
    TeamNotCompleteError,
    TournamentAlreadyStartedError,
    TournamentDeletedError,
)
from app.core.slug import MAX_LENGTH, normalize_slug, random_slug, slugify
from app.models.team import Team, TeamMember
from app.models.tournament import Game, JoinPolicy, Tournament, TournamentMode, TournamentTeam, TournamentVisibility
from app.models.tournament_role import TournamentRoleType, TournamentUserRole
from app.repositories.tournament_repository import tournament_repository
from app.schemas.team import TeamResponse
from app.schemas.tournament import TournamentCreate, TournamentUpdate
from app.services.invitation_service import InvitationService
from app.services.invite_service import InviteService
from app.services.revision import bump
from app.services.schedule import validate_schedule
from app.services.station_service import StationService
from app.services.team_service import TeamService
from fastapi import Depends
from typing import Annotated
from app.core.database import DbSession
from app.core.security import get_optional_user
from app.models.user import User


# settings that only matter before the start (the schedule and who may join)
BEFORE_START_ONLY = (
    "start_time",
    "registration_end_time",
    "registration_auto_close",
    "checkin_enabled",
    "checkin_start_time",
    "checkin_auto_open",
    "join_policy",
    # what is played and how: the bracket is drawn for them at the start
    "game",
    "mode",
)



def _same(a, b) -> bool:
    """Equal values; times without a zone (SQLite) count as UTC."""
    if isinstance(a, datetime) and isinstance(b, datetime):
        return (a if a.tzinfo else a.replace(tzinfo=UTC)) == (b if b.tzinfo else b.replace(tzinfo=UTC))
    return a == b


def _check_mode(game: Game, mode: TournamentMode) -> None:
    """Every game has its modes (app/games.py)."""
    if mode not in GAMES[game].modes:
        raise InvalidModeError(GAMES[game].label)


class TournamentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_tournament(self, data: TournamentCreate, creator_id: UUID) -> Tournament:
        """Create a new tournament and assign the creator as Admin."""
        _check_mode(data.game, data.mode)
        validate_schedule(data.start_time, data.registration_end_time, data.checkin_enabled, data.checkin_start_time)
        obj_in = self._normalize_automation(data.model_dump())
        station_count = obj_in.pop("station_count")
        obj_in["slug"] = await self._unique_slug(slugify(data.name))
        obj_in["created_by_id"] = creator_id
        tournament = await tournament_repository.create(self.db, obj_in=obj_in)
        await self.db.flush()
        await StationService(self.db).create_default_stations(tournament.id, station_count, stations_of(tournament.game))

        # Assign Admin role to the creator
        admin_role = TournamentUserRole(
            tournament_id=tournament.id,
            user_id=creator_id,
            role=TournamentRoleType.ADMIN,
        )
        self.db.add(admin_role)
        if tournament.join_policy == JoinPolicy.INVITE_ONLY:
            await InviteService(self.db).ensure_one(tournament.id, creator_id)

        return tournament


    async def _slug_exists(self, slug: str) -> bool:
        return (await self.db.execute(select(Tournament.id).where(Tournament.slug == slug))).first() is not None

    async def _unique_slug(self, base: str) -> str:
        """The title as address; a number is appended if it is taken ("sommerfest", "sommerfest-2", ...)."""
        candidate, n = base, 1
        while await self._slug_exists(candidate):
            n += 1
            suffix = f"-{n}"
            candidate = f"{base[: MAX_LENGTH - len(suffix)].rstrip('-')}{suffix}"
            if n > 99:
                candidate = f"{base[: MAX_LENGTH - 8].rstrip('-')}-{random_slug(6)}"
        return candidate

    async def get_tournament_by_slug(self, slug: str) -> Tournament:
        """Look a tournament up by its address. Unknown and deleted addresses answer the same."""
        result = await self.db.execute(
            select(Tournament).where(Tournament.slug == slug.lower(), Tournament.is_deleted == False)  # noqa: E712
        )
        tournament = result.scalar_one_or_none()
        if tournament is None:
            raise NotFoundError("Turnier")
        return tournament

    async def get_tournament(self, tournament_id: UUID, *, for_update: bool = False) -> Tournament:
        """Get a tournament by ID. Raises NotFoundError for missing or deleted tournaments.

        `for_update` locks the row for the rest of the transaction. Use it for check-then-write
        flows (join, leave, start, bracket generation) so they cannot interleave.
        """
        tournament = await tournament_repository.get_by_id(self.db, tournament_id, for_update=for_update)
        if tournament is None:
            raise NotFoundError("Turnier")
        if tournament.is_deleted:
            raise TournamentDeletedError()
        return tournament

    async def is_involved(self, tournament_id: UUID, user_id: UUID | None) -> bool:
        """Does the user have a role in the tournament or play in it? Strangers (no login) never do."""
        if user_id is None:
            return False
        role = await self.db.execute(
            select(TournamentUserRole.id).where(
                TournamentUserRole.tournament_id == tournament_id, TournamentUserRole.user_id == user_id
            )
        )
        if role.first() is not None:
            return True
        participant = await self.db.execute(
            select(TeamMember.id)
            .join(TournamentTeam, TournamentTeam.team_id == TeamMember.team_id)
            .where(TournamentTeam.tournament_id == tournament_id, TeamMember.user_id == user_id)
        )
        return participant.first() is not None

    async def get_tournament_for_user(self, tournament_id: UUID, user_id: UUID | None) -> Tournament:
        """Get a tournament if the viewer may see it: public ones by everybody (also without login), private ones
        by helpers and participants."""
        tournament = await self.get_tournament(tournament_id)

        if tournament.visibility == TournamentVisibility.PUBLIC:
            return tournament
        if await self.is_involved(tournament_id, user_id):
            return tournament
        raise HTTPException(status_code=403, detail="Dieses Turnier ist privat. Du hast keinen Zugriff.")


    @staticmethod
    def _normalize_automation(values: dict) -> dict:
        """No check-in: no check-in time. An automation without its time cannot run, so it is switched off."""
        values = dict(values)
        if not values["checkin_enabled"]:
            values["checkin_start_time"] = None
        values["registration_auto_close"] = bool(values.get("registration_auto_close")) and bool(
            values.get("registration_end_time")
        )
        values["checkin_auto_open"] = bool(values.get("checkin_auto_open")) and bool(values.get("checkin_start_time"))
        return values

    async def update_tournament(self, tournament_id: UUID, data: TournamentUpdate) -> Tournament:
        """Update tournament details cleanly."""
        tournament = await self.get_tournament(tournament_id)

        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return tournament

        # the schedule and who may join only matter before the start: afterwards they stay as they were
        if tournament.is_started and any(
            key in update_data and not _same(update_data[key], getattr(tournament, key)) for key in BEFORE_START_ONLY
        ):
            raise TournamentAlreadyStartedError()

        game = update_data.get("game") or tournament.game
        _check_mode(game, update_data.get("mode") or tournament.mode)
        if game != tournament.game:
            await StationService(self.db).rename_defaults(tournament.id, stations_of(tournament.game), stations_of(game))

        if "slug" in update_data:
            slug = normalize_slug(update_data["slug"]) if update_data["slug"] is not None else tournament.slug
            if slug == tournament.slug:
                del update_data["slug"]
            elif await self._slug_exists(slug):
                raise SlugTakenError()
            else:
                update_data["slug"] = slug

        merged = {
            field: update_data.get(field, getattr(tournament, field))
            for field in ("start_time", "registration_end_time", "checkin_enabled", "checkin_start_time")
        }
        validate_schedule(
            merged["start_time"], merged["registration_end_time"], merged["checkin_enabled"], merged["checkin_start_time"]
        )
        merged["registration_auto_close"] = update_data.get(
            "registration_auto_close", tournament.registration_auto_close
        )
        merged["checkin_auto_open"] = update_data.get("checkin_auto_open", tournament.checkin_auto_open)
        update_data.update(
            {
                key: value
                for key, value in self._normalize_automation(merged).items()
                if key in ("checkin_start_time", "registration_auto_close", "checkin_auto_open")
            }
        )

        updated = await tournament_repository.update(self.db, db_obj=tournament, obj_in=update_data)
        await bump(self.db, tournament_id, "tournament")
        if updated.join_policy == JoinPolicy.INVITE_ONLY:
            await InviteService(self.db).ensure_one(updated.id, updated.created_by_id)
            await self.db.refresh(updated)  # the flush reloaded server-side columns (updated_at)
        return updated


    async def delete_tournament(self, tournament_id: UUID) -> None:
        """Soft delete a tournament."""
        tournament = await self.get_tournament(tournament_id)
        await tournament_repository.update(self.db, db_obj=tournament, obj_in={"is_deleted": True})
        await bump(self.db, tournament_id, "tournament")


    async def get_my_tournaments(self, user_id: UUID) -> dict:
        """Get customized tournament groupings for the user."""
        participating_res, managing_res = await tournament_repository.get_my_tournaments(self.db, user_id)

        participating = []
        for tournament, team, frozen_name, is_checked_in in participating_res:
            # a tournament that started shows the team under the name it had then
            participating.append({
                "tournament": tournament,
                "team": TeamResponse.model_validate(team).model_copy(update={"name": frozen_name or team.name}),
                "is_checked_in": is_checked_in,
                **(await self._my_progress(tournament, team.id) if tournament.is_started else {}),
            })

        managing = []
        for tournament, role in managing_res:
            managing.append({
                "tournament": tournament,
                "role": role
            })

        return {
            "participating": participating,
            "managing": managing
        }

    async def _my_progress(self, tournament: Tournament, team_id: UUID) -> dict:
        """The next match of a team in a started tournament, or its place once it is out or has won."""
        from app.schemas.match import MatchStatus
        from app.services.bracket_service import BracketService  # imported here: the bracket uses this service

        bracket = await BracketService(self.db).get_bracket(tournament.id)
        mine = sorted(
            (m for m in bracket.matches if team_id in (m.team_a_id, m.team_b_id)), key=lambda m: (m.round, m.position)
        )
        if bracket.champion_team_id == team_id:
            return {"place": 1}
        if bracket.standings is not None:
            # everybody against everybody: the rank once all is played, before that the next match
            if tournament.finished_at:
                return {"place": next((row.rank for row in bracket.standings if row.team_id == team_id), None)}
        else:
            lost = next((m for m in mine if m.winner_team_id is not None and m.winner_team_id != team_id), None)
            if lost is not None:
                return {"place": 2 ** (bracket.total_rounds - lost.round) + 1}
        return {"next_match": next((m for m in mine if m.status != MatchStatus.FINISHED), None)}

    async def join_tournament(self, tournament_id: UUID, team_id: UUID, user_id: UUID) -> TournamentTeam:
        """Join a tournament with a team. Implements the 5-step validation from requirements."""
        tournament = await self.get_tournament(tournament_id, for_update=True)
        if tournament.is_started:
            raise TournamentAlreadyStartedError()
        if not tournament.registration_open:
            raise RegistrationClosedError()

        # only with an invitation: an open one of the person who joins (from a link or from the organization)
        invitation = await InvitationService(self.db).has_open(tournament_id, user_id)
        if tournament.join_policy == JoinPolicy.INVITE_ONLY and invitation is None:
            raise InviteRequiredError()

        team = await TeamService(self.db).get_team(team_id)
        member_count = await TeamService(self.db).get_team_member_count(team_id)
        if member_count < team.max_size:
            raise TeamNotCompleteError()

        team_members = await TeamService(self.db).get_team_members(team_id)
        member_user_ids = [m.user_id for m in team_members]

        for uid in member_user_ids:
            existing = await self.db.execute(
                select(TournamentTeam)
                .join(TeamMember, TeamMember.team_id == TournamentTeam.team_id)
                .where(
                    TournamentTeam.tournament_id == tournament_id,
                    TeamMember.user_id == uid,
                )
            )
            if existing.scalar_one_or_none() is not None:
                raise PlayerAlreadyInTournamentError()

        entry = TournamentTeam(
            tournament_id=tournament_id, team_id=team_id, invite_id=invitation.invite_id if invitation else None
        )
        self.db.add(entry)
        await InvitationService(self.db).team_joined(tournament_id, team_id, member_user_ids)
        await bump(self.db, tournament_id, "teams")
        return entry


    async def get_tournament_teams(self, tournament_id: UUID) -> list[tuple[Team, bool, str]]:
        """The teams of a tournament with their check-in and the name they play under (frozen at the start)."""
        result = await self.db.execute(
            select(Team, TournamentTeam.is_checked_in, func.coalesce(TournamentTeam.team_name, Team.name))
            .join(TournamentTeam, TournamentTeam.team_id == Team.id)
            .where(TournamentTeam.tournament_id == tournament_id)
        )
        return list(result.all())

    async def leave_tournament(self, tournament_id: UUID, user_id: UUID) -> None:
        """Withdraw a team from a tournament: only while the registration is open (like joining)."""
        tournament = await self.get_tournament(tournament_id, for_update=True)
        if tournament.is_started:
            raise TournamentAlreadyStartedError()
        if not tournament.registration_open:
            raise RegistrationClosedError()

        team_q = (
            select(Team)
            .join(TournamentTeam, TournamentTeam.team_id == Team.id)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(
                TournamentTeam.tournament_id == tournament_id,
                TeamMember.user_id == user_id,
            )
        )
        result = await self.db.execute(team_q)
        team = result.scalar_one_or_none()

        if not team:
            raise HTTPException(status_code=400, detail="Du spielst in diesem Turnier nicht mit.")

        await self.db.execute(
            delete(TournamentTeam)
            .where(
                TournamentTeam.tournament_id == tournament_id,
                TournamentTeam.team_id == team.id
            )
        )
        await InvitationService(self.db).team_left(tournament_id, team.id)
        await bump(self.db, tournament_id, "teams")

    async def remove_team(self, tournament_id: UUID, team_id: UUID) -> None:
        """Remove a specific team from a tournament (Admin action, only before it starts)."""
        if (await self.get_tournament(tournament_id, for_update=True)).is_started:
            raise TournamentAlreadyStartedError()
        result = await self.db.execute(
            delete(TournamentTeam)
            .where(
                TournamentTeam.tournament_id == tournament_id,
                TournamentTeam.team_id == team_id
            )
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=400, detail="Dieses Team spielt in diesem Turnier nicht mit.")
        await InvitationService(self.db).team_left(tournament_id, team_id)
        await bump(self.db, tournament_id, "teams")



    async def checkin_team(self, tournament_id: UUID, team_id: UUID, is_checked_in: bool) -> None:
        """Update check-in status for a team in a tournament."""
        tournament = await self.get_tournament(tournament_id)
        if tournament.is_started:
            raise TournamentAlreadyStartedError()
        if not tournament.checkin_enabled:
            raise CheckinDisabledError()
        if not tournament.checkin_open:
            raise CheckinNotOpenError()
        
        result = await self.db.execute(
            select(TournamentTeam)
            .where(
                TournamentTeam.tournament_id == tournament_id,
                TournamentTeam.team_id == team_id
            )
        )
        tournament_team = result.scalar_one_or_none()
        
        if not tournament_team:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Dieses Team spielt in diesem Turnier nicht mit.")
            
        tournament_team.is_checked_in = is_checked_in
        await bump(self.db, tournament_id, "teams")


def get_tournament_service(db: DbSession) -> TournamentService:
    return TournamentService(db)



async def get_accessible_tournament(
    tournament_id: UUID,
    viewer: Annotated[User | None, Depends(get_optional_user)],
    service: Annotated[TournamentService, Depends(get_tournament_service)],
) -> Tournament:
    """Dependency for every read endpoint of a tournament: enforces the visibility rules.

    Public tournaments can be read by everybody, also without login. Private ones only by role holders and
    participants.
    """
    return await service.get_tournament_for_user(tournament_id, viewer.id if viewer else None)
