import { strongestRole } from "@/lib/roles";
import type { MyTournamentsResponse, ParticipatingTournament, Team, Tournament, TournamentRoleType } from "@/types";

/** A tournament of the logged-in user with the way they are involved: with a team, with a role, or both. */
export interface MyTournament {
  tournament: Tournament;
  team?: Team;
  /** How my team is doing (check-in, next match, place); only when I play. */
  participation?: Pick<ParticipatingTournament, "is_checked_in" | "next_match" | "place">;
  role?: TournamentRoleType;
}

export interface TournamentGroups {
  active: MyTournament[];
  planned: MyTournament[];
  finished: MyTournament[];
}

/** One entry per tournament, even if the user plays in it and manages it. */
export function mergeMyTournaments(data: MyTournamentsResponse): MyTournament[] {
  const byId = new Map<string, MyTournament>();
  for (const { tournament, team, ...participation } of data.participating) {
    byId.set(tournament.id, { tournament, team, participation });
  }
  // a user can hold several roles in a tournament (admin and referee): the strongest one counts
  for (const { tournament, role } of data.managing) {
    const known = byId.get(tournament.id);
    const held = known?.role ? [known.role, role] : [role];
    byId.set(tournament.id, { ...known, tournament, role: strongestRole(held) ?? role });
  }
  return [...byId.values()];
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
const plannedAt = (t: Tournament) => time(t.start_time ?? t.created_at);

/**
 * Running tournaments (latest start first), planned ones (soonest first) and finished ones (latest end first).
 * The API decides what finished means, the list only sorts into the three groups.
 */
export function groupTournaments(items: MyTournament[]): TournamentGroups {
  const active = items.filter((i) => i.tournament.started_at && !i.tournament.finished_at);
  const planned = items.filter((i) => !i.tournament.started_at);
  const finished = items.filter((i) => i.tournament.finished_at);

  return {
    active: active.sort((a, b) => time(b.tournament.started_at) - time(a.tournament.started_at)),
    planned: planned.sort((a, b) => plannedAt(a.tournament) - plannedAt(b.tournament)),
    finished: finished.sort((a, b) => time(b.tournament.finished_at) - time(a.tournament.finished_at)),
  };
}
