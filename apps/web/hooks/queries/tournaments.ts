import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { successMessage } from "@/lib/query-client";
import { queryKeys, tournamentKeys } from "@/lib/query-keys";
import { ROLE_INFO } from "@/lib/roles";
import type { Tournament, TournamentCreateRequest, TournamentRoleType, TournamentStartResponse, TournamentTeam } from "@/types";
import type { StationTerms } from "@/components/games";

// -- lists and lookups

/** `enabled: false` while nobody is logged in. */
export function useMyTournaments({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: queryKeys.myTournaments, queryFn: api.tournaments.getMyTournaments, enabled });
}

export function useTournamentBySlug(slug: string) {
  return useQuery({ queryKey: queryKeys.tournamentBySlug(slug), queryFn: () => api.tournaments.getBySlug(slug) });
}

export function useTournamentById(id: string) {
  return useQuery({ queryKey: queryKeys.tournamentById(id), queryFn: () => api.tournaments.get(id) });
}

/** What a stranger may see of a tournament; only asked when the tournament itself is not visible. */
export function useTournamentPreview(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.tournamentPreview(slug),
    queryFn: () => api.tournaments.getPreview(slug),
    enabled,
  });
}

/** The tournament behind an invitation link (works without login). */
export function useInvitePreview(token: string) {
  return useQuery({ queryKey: queryKeys.invite(token), queryFn: () => api.invites.get(token) });
}

// -- the parts of one tournament (`id` is empty while the tournament is not loaded yet)

export function useTournamentTeams(id: string) {
  return useQuery({ queryKey: queryKeys.tournamentTeams(id), queryFn: () => api.tournaments.getTeams(id), enabled: !!id });
}

export function useTournamentRoles(id: string) {
  return useQuery({ queryKey: queryKeys.tournamentRoles(id), queryFn: () => api.roles.list(id), enabled: !!id });
}

export function useStations(id: string, terms: StationTerms) {
  return useQuery({
    queryKey: queryKeys.tournamentStations(id),
    queryFn: () => api.tournaments.listStations(id),
    enabled: !!id,
    meta: { errorMessage: `Die ${terms.plural} konnten nicht geladen werden.` },
  });
}

/** The bracket, `null` before the start (it is drawn at the start). */
export function useBracket(id: string) {
  return useQuery({
    queryKey: queryKeys.bracket(id),
    queryFn: () => api.tournaments.getBracket(id),
    enabled: !!id,
    select: (bracket) => (bracket.matches.length > 0 ? bracket : null),
  });
}

export function useTournamentInvites(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.tournamentInvites(id),
    queryFn: () => api.tournaments.listInvites(id),
    enabled,
    meta: { errorMessage: "Die Einladungslinks konnten nicht geladen werden." },
  });
}

// -- changes

export function useCreateTournament() {
  return useMutation({
    mutationFn: (data: TournamentCreateRequest) => api.tournaments.create(data),
    meta: { inlineError: true, invalidates: [queryKeys.myTournaments], successMessage: "Turnier erstellt." },
  });
}

/** Settings of a tournament. An address that is taken or invalid belongs to its field, all else is a toast. */
export function useUpdateTournament(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<TournamentCreateRequest>) => api.tournaments.update(id, data),
    onSuccess: (saved: Tournament) => queryClient.setQueryData(queryKeys.tournamentBySlug(saved.slug), saved),
    meta: {
      inlineError: (error) => isSlugError(error),
      invalidates: tournamentKeys(id, ["tournament"]),
      successMessage: "Gespeichert.",
    },
  });
}

const SLUG_ERRORS = new Set(["SLUG_TAKEN", "INVALID_SLUG"]);
export function isSlugError(error: unknown): boolean {
  const code = error instanceof ApiError ? error.data?.error_code : undefined;
  return typeof code === "string" && SLUG_ERRORS.has(code);
}

export function useDeleteTournament(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.tournaments.delete(id),
    onSuccess: () => queryClient.removeQueries({ queryKey: queryKeys.tournament(id) }),
    meta: { invalidates: [queryKeys.myTournaments, queryKeys.tournamentLookups], successMessage: "Turnier gelöscht." },
  });
}

export function useJoinTournament(id: string) {
  return useMutation({
    mutationFn: (teamId: string) => api.tournaments.join(id, teamId),
    meta: {
      inlineError: true,
      // a stranger becomes a participant: the tournament itself is visible now
      invalidates: [...tournamentKeys(id, ["tournament", "teams"]), queryKeys.teams],
      successMessage: "Du bist dabei. Viel Erfolg!",
    },
  });
}

export function useLeaveTournament(id: string) {
  return useMutation({
    mutationFn: () => api.tournaments.leave(id),
    meta: { invalidates: tournamentKeys(id, ["tournament", "teams"]), successMessage: "Du hast das Turnier verlassen." },
  });
}

export function useRemoveTeam(id: string) {
  return useMutation({
    mutationFn: (team: Pick<TournamentTeam, "id" | "name">) => api.tournaments.removeTeam(id, team.id),
    meta: {
      invalidates: tournamentKeys(id, ["tournament", "teams"]),
      successMessage: successMessage((_: unknown, team: Pick<TournamentTeam, "name">) => `${team.name} entfernt.`),
    },
  });
}

/**
 * Check a team in or out. Optimistic: the switch moves at once and jumps back with the toast if the server refuses.
 */
export function useCheckin(id: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.tournamentTeams(id);
  return useMutation({
    mutationFn: ({ teamId, checkedIn }: { teamId: string; checkedIn: boolean }) => api.tournaments.checkin(id, teamId, checkedIn),
    onMutate: async ({ teamId, checkedIn }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<TournamentTeam[]>(key);
      queryClient.setQueryData<TournamentTeam[]>(key, (teams) =>
        teams?.map((team) => (team.id === teamId ? { ...team, is_checked_in: checkedIn } : team)),
      );
      return { before };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(key, context?.before),
    meta: {
      invalidates: tournamentKeys(id, ["teams"]),
      errorMessage: "Der Check-in konnte nicht gespeichert werden. Versuch es noch einmal.",
    },
  });
}

/** Open or close the registration or the check-in by hand. */
export function useSetPhaseOpen(id: string) {
  return useMutation({
    mutationFn: ({ kind, open }: { kind: "registration" | "checkin"; open: boolean }) =>
      kind === "registration" ? api.tournaments.setRegistrationOpen(id, open) : api.tournaments.setCheckinOpen(id, open),
    meta: {
      invalidates: tournamentKeys(id, ["tournament"]),
      successMessage: successMessage((_: unknown, { kind, open }: { kind: "registration" | "checkin"; open: boolean }) => {
        const what = kind === "registration" ? "Anmeldung" : "Check-in";
        return `${what} ${open ? "geöffnet" : "geschlossen"}.`;
      }),
    },
  });
}

export function useStartKnockout(id: string) {
  return useMutation({
    mutationFn: (order: Record<number, string[]>) => api.tournaments.startKnockout(id, order),
    meta: { invalidates: tournamentKeys(id, ["tournament", "bracket"]), successMessage: "K.-o.-Runde gestartet." },
  });
}

export function useStartTournament(id: string) {
  return useMutation({
    mutationFn: () => api.tournaments.startTournament(id),
    meta: {
      invalidates: tournamentKeys(id, ["tournament", "teams", "bracket"]),
      successMessage: successMessage(({ removed_team_ids: removed }: TournamentStartResponse) => {
        if (removed.length === 0) return "Turnier gestartet.";
        const teams = removed.length === 1 ? "1 Team" : `${removed.length} Teams`;
        return `Turnier gestartet. ${teams} ohne Check-in entfernt.`;
      }),
    },
  });
}

// -- stations

export function useAddStation(id: string, terms: StationTerms) {
  return useMutation({
    mutationFn: () => api.tournaments.addStation(id),
    meta: { invalidates: tournamentKeys(id, ["bracket"]), successMessage: `${terms.singular} hinzugefügt.` },
  });
}

export function useRenameStation(id: string) {
  return useMutation({
    mutationFn: ({ stationId, name }: { stationId: string; name: string }) => api.tournaments.renameStation(id, stationId, name),
    meta: { inlineError: true, invalidates: tournamentKeys(id, ["bracket"]) },
  });
}

export function useDeleteStation(id: string, terms: StationTerms) {
  return useMutation({
    mutationFn: (stationId: string) => api.tournaments.deleteStation(id, stationId),
    meta: { invalidates: tournamentKeys(id, ["bracket"]), successMessage: `${terms.singular} gelöscht.` },
  });
}

// -- invitation links

export function useCreateTournamentInvite(id: string) {
  return useMutation({
    mutationFn: (label: string) => api.tournaments.createInvite(id, label),
    meta: {
      invalidates: [queryKeys.tournamentInvites(id)],
      successMessage: "Link erstellt.",
      errorMessage: "Der Link konnte nicht erstellt werden. Versuch es noch einmal.",
    },
  });
}

export function useDeleteTournamentInvite(id: string) {
  return useMutation({
    mutationFn: (inviteId: string) => api.tournaments.deleteInvite(id, inviteId),
    meta: { invalidates: [queryKeys.tournamentInvites(id)], successMessage: "Link gelöscht." },
  });
}

// -- roles

interface AssignRole {
  userId: string;
  role: TournamentRoleType;
  /** For the message: "Ada ist jetzt Schiedsrichter." */
  userName: string;
}

export function useAssignRole(id: string) {
  return useMutation({
    mutationFn: ({ userId, role }: AssignRole) => api.roles.assign(id, userId, role),
    meta: {
      invalidates: tournamentKeys(id, ["roles"]),
      successMessage: successMessage(
        (_: unknown, { userName, role }: AssignRole) => `${userName} ist jetzt ${ROLE_INFO[role].label}.`,
      ),
    },
  });
}

export function useRevokeRole(id: string) {
  return useMutation({
    mutationFn: (roleId: string) => api.roles.revoke(id, roleId),
    meta: { invalidates: tournamentKeys(id, ["roles"]), successMessage: "Rolle entzogen." },
  });
}
