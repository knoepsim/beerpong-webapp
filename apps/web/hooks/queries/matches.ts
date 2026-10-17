import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { successMessage } from "@/lib/query-client";
import { queryKeys, tournamentKeys } from "@/lib/query-keys";
import { ResultType, type Match, type Result } from "@/types";

/** The history of the results of a match, oldest first. */
export function useMatchResults(matchId: string | null | undefined, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.matchResults(matchId ?? ""),
    queryFn: () => api.results.list(matchId!),
    enabled: enabled && !!matchId,
    // a result someone else reported a moment ago must not be overwritten unseen
    staleTime: 0,
  });
}

/** The result that counts: the last entry, unless it was deleted. */
export function currentResult(results: Result[] | undefined): Result | null {
  const last = results?.at(-1);
  return last && last.type !== ResultType.DELETED ? last : null;
}

interface StartVariables {
  match: Pick<Match, "id" | "table_name">;
  started: boolean;
}

/** Start a match at its table, or take the start back (a slip happens under time pressure). */
export function useSetMatchStarted(tournamentId: string) {
  return useMutation({
    mutationFn: ({ match, started }: StartVariables) => (started ? api.matches.start(match.id) : api.matches.undoStart(match.id)),
    meta: {
      invalidates: tournamentKeys(tournamentId, ["bracket"]),
      successMessage: successMessage((_: unknown, { match, started }: StartVariables) => {
        const where = match.table_name ? ` an ${match.table_name}` : "";
        return started ? `Spiel${where} gestartet.` : `Start${where} zurückgenommen.`;
      }),
    },
  });
}

/** Report a result or change it (`existing`); without cups the winner had all of them left. */
export function useSaveResult(tournamentId: string, matchId: string) {
  return useMutation({
    mutationFn: ({ winnerTeamId, cupsLeft, existing }: { winnerTeamId: string; cupsLeft: number; existing: boolean }) =>
      existing ? api.results.modify(matchId, winnerTeamId, cupsLeft) : api.results.create(matchId, winnerTeamId, cupsLeft),
    meta: {
      inlineError: true,
      invalidates: tournamentKeys(tournamentId, ["bracket"]),
      successMessage: successMessage((_: unknown, { existing }: { existing: boolean }) =>
        existing ? "Ergebnis geändert." : "Ergebnis gespeichert.",
      ),
    },
  });
}

export function useDeleteResult(tournamentId: string, matchId: string) {
  return useMutation({
    mutationFn: () => api.results.delete(matchId),
    meta: {
      inlineError: true,
      invalidates: tournamentKeys(tournamentId, ["bracket"]),
      successMessage: "Ergebnis gelöscht.",
    },
  });
}
