import type { QueryKey } from "@tanstack/react-query";
import type { LiveScope } from "@/lib/live-connection";

/**
 * Every query key of the app in one place, so a change can name exactly what it makes stale. Everything of one
 * tournament lives under ["tournament", id, ...]; the tournament itself is looked up by its address (slug).
 */
export const queryKeys = {
  me: ["me"] as const,
  teams: ["teams"] as const,
  teamInvite: (token: string) => ["teams", "invite", token] as const,
  userSearch: (query: string) => ["users", "search", query] as const,
  myTournaments: ["tournaments", "mine"] as const,
  invite: (token: string) => ["invites", token] as const,
  /** All lookups of tournaments by address or id (a change of the tournament makes all of them stale). */
  tournamentLookups: ["tournament", "lookup"] as const,
  tournamentBySlug: (slug: string) => ["tournament", "lookup", "slug", slug] as const,
  tournamentById: (id: string) => ["tournament", "lookup", "id", id] as const,
  /** What a stranger may see; not part of the lookups, it does not change with every revision. */
  tournamentPreview: (slug: string) => ["tournament", "preview", slug] as const,
  tournament: (id: string) => ["tournament", id] as const,
  tournamentTeams: (id: string) => ["tournament", id, "teams"] as const,
  tournamentRoles: (id: string) => ["tournament", id, "roles"] as const,
  tournamentTables: (id: string) => ["tournament", id, "tables"] as const,
  tournamentInvites: (id: string) => ["tournament", id, "invites"] as const,
  bracket: (id: string) => ["tournament", id, "bracket"] as const,
  /** The result history of all matches (a changed bracket can change any of them). */
  results: ["results"] as const,
  matchResults: (matchId: string) => ["results", matchId] as const,
};

/**
 * What is stale when a part of a tournament changed. The live connection (another device changed it) and the own
 * changes use the same mapping, so a screen always reloads the same things. "Meine Turniere" is marked stale too: it
 * shows the phase, the own team and the next match of every tournament (it is loaded again when it is opened).
 */
const SCOPE_KEYS: Record<LiveScope, (id: string) => QueryKey[]> = {
  tournament: () => [queryKeys.tournamentLookups, queryKeys.myTournaments],
  teams: (id) => [queryKeys.tournamentTeams(id), queryKeys.myTournaments],
  // the tables belong to the bracket: who plays where
  bracket: (id) => [queryKeys.bracket(id), queryKeys.tournamentTables(id), queryKeys.results, queryKeys.myTournaments],
  roles: (id) => [queryKeys.tournamentRoles(id), queryKeys.myTournaments],
};

export function tournamentKeys(id: string, scopes: LiveScope[]): QueryKey[] {
  return scopes.flatMap((scope) => SCOPE_KEYS[scope](id));
}
