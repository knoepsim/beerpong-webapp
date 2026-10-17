import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { successMessage } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import type { Team } from "@/types";

/**
 * My teams; `enabled: false` while nobody is logged in. `fresh`: asked again whenever the page is seen again (a team
 * mate may have joined in the meantime, e.g. while the invitation link was being shared).
 */
export function useMyTeams({ enabled = true, fresh = false }: { enabled?: boolean; fresh?: boolean } = {}) {
  return useQuery({ queryKey: queryKeys.teams, queryFn: api.teams.list, enabled, ...(fresh ? { staleTime: 0 } : {}) });
}

/** A new team shows up in "Meine Teams" right away (the list is loaded again before the mutation is done). */
export function useCreateTeam() {
  return useMutation({
    mutationFn: (name: string) => api.teams.create(name),
    meta: {
      inlineError: true,
      invalidates: [queryKeys.teams],
      successMessage: successMessage((team: Team) => `${team.name} gegründet.`),
    },
  });
}

export function useRenameTeam() {
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.teams.update(id, name),
    // a tournament before its start shows the current name of its teams
    meta: {
      inlineError: true,
      invalidates: [queryKeys.teams, ["tournament"]],
      successMessage: "Team umbenannt.",
    },
  });
}

export function useDeleteTeam() {
  return useMutation({
    mutationFn: (id: string) => api.teams.delete(id),
    meta: { invalidates: [queryKeys.teams], successMessage: "Team gelöscht." },
  });
}

/** A new invitation link of a team (copied or shared by the caller). */
export function useCreateTeamInvite() {
  return useMutation({
    mutationFn: (teamId: string) => api.teams.createInvite(teamId),
    meta: { errorMessage: "Die Einladung konnte nicht erstellt werden. Versuch es noch einmal." },
  });
}

export function useTeamInvite(token: string) {
  return useQuery({ queryKey: queryKeys.teamInvite(token), queryFn: () => api.teams.getInviteDetails(token) });
}

export function useAcceptTeamInvite(token: string) {
  return useMutation({
    mutationFn: () => api.teams.acceptInvite(token),
    meta: {
      inlineError: true,
      invalidates: [queryKeys.teams],
      successMessage: successMessage((team: Team) => `Du bist jetzt im Team ${team.name}.`),
    },
  });
}
