import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { successMessage } from "@/lib/query-client";
import { queryKeys, tournamentKeys } from "@/lib/query-keys";
import { ResultType, type Match, type ReportedResult, type Result } from "@/types";

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
  match: Pick<Match, "id" | "station_name">;
  started: boolean;
}

/** Start a match at its station, or take the start back (a slip happens under time pressure). */
export function useSetMatchStarted(tournamentId: string) {
  return useMutation({
    mutationFn: ({ match, started }: StartVariables) => (started ? api.matches.start(match.id) : api.matches.undoStart(match.id)),
    meta: {
      invalidates: tournamentKeys(tournamentId, ["bracket"]),
      successMessage: successMessage((_: unknown, { match, started }: StartVariables) => {
        const where = match.station_name ? ` an ${match.station_name}` : "";
        return started ? `Spiel${where} gestartet.` : `Start${where} zurückgenommen.`;
      }),
    },
  });
}

/** Report a result or change it (`existing`): the winner and the score of both teams. */
export function useSaveResult(tournamentId: string, matchId: string) {
  return useMutation({
    mutationFn: ({ existing, ...result }: ReportedResult & { existing: boolean }) =>
      existing ? api.results.modify(matchId, result) : api.results.create(matchId, result),
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
