import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTournamentLive } from "@/hooks/use-tournament-live";
import {
  useBracket,
  useTournamentBySlug,
  useTournamentPreview,
  useTournamentRoles,
  useTournamentTables,
  useTournamentTeams,
} from "@/hooks/queries/tournaments";
import { ApiError } from "@/lib/api";
import { tournamentKeys } from "@/lib/query-keys";
import type { Team } from "@/types";

/**
 * Everything the page of a tournament shows, kept current: the server says over the live connection which parts
 * changed and exactly those are loaded again (the same mapping as after an own change, see `tournamentKeys`).
 */
export function useTournament(slug: string) {
  const queryClient = useQueryClient();
  const tournamentQuery = useTournamentBySlug(slug);
  const tournament = tournamentQuery.data;
  // the address is /t/{slug}; everything else is asked for by the id behind it
  const id = tournament?.id ?? "";
  const teamsQuery = useTournamentTeams(id);
  const rolesQuery = useTournamentRoles(id);
  const tablesQuery = useTournamentTables(id);
  const bracketQuery = useBracket(id);

  // a tournament that is not visible to me may still be open to join: what a stranger may see
  const denied =
    tournamentQuery.error instanceof ApiError && (tournamentQuery.error.status === 403 || tournamentQuery.error.status === 404);
  const previewQuery = useTournamentPreview(slug, denied);

  const live = useTournamentLive({
    tournamentId: tournament?.id,
    revision: tournament?.revision,
    onChange: async (scopes) => {
      await Promise.all(tournamentKeys(id, scopes).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });

  const parts = [teamsQuery, rolesQuery, tablesQuery, bracketQuery];
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);
  const teamsMap = useMemo(() => {
    const map: Record<string, Team> = {};
    for (const team of teams) map[team.id] = team;
    return map;
  }, [teams]);

  return {
    tournament,
    teams,
    teamsMap,
    roles: rolesQuery.data ?? [],
    tables: tablesQuery.data ?? [],
    bracket: bracketQuery.data ?? null,
    preview: denied ? previewQuery.data : undefined,
    /** The first load: the page waits for all parts, so it does not jump while they come in. */
    isLoading:
      tournamentQuery.isPending ||
      (!!tournament && parts.some((query) => query.isPending)) ||
      (denied && previewQuery.isPending),
    /** Only a failed first load: a failed refresh keeps the last state (and says so in a toast). */
    error: tournamentQuery.error ?? parts.find((query) => query.data === undefined && query.error)?.error ?? null,
    retry: () => {
      for (const query of [tournamentQuery, ...parts]) if (query.isError) void query.refetch();
    },
    live,
  };
}
