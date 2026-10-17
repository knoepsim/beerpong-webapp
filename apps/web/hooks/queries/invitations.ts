import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { successMessage } from "@/lib/query-client";
import { queryKeys, tournamentKeys } from "@/lib/query-keys";
import type { Invitation, TournamentInvitation } from "@/types";

// -- the invited person

/** My open invitations (for "Meine Turniere" and the number at "Turniere"); `enabled: false` without login. */
export function useMyInvitations({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: queryKeys.invitations, queryFn: api.invitations.list, enabled });
}

export function useInvitation(id: string) {
  return useQuery({ queryKey: queryKeys.invitation(id), queryFn: () => api.invitations.get(id) });
}

/** Opening a link while logged in keeps its invitation in my account. */
export function useAcceptInviteLink() {
  return useMutation({
    mutationFn: (token: string) => api.invites.accept(token),
    meta: { inlineError: true, invalidates: [queryKeys.invitations] },
  });
}

export function useAcceptInvitation(invitation: Pick<Invitation, "id" | "tournament">) {
  return useMutation({
    mutationFn: (teamId: string) => api.invitations.accept(invitation.id, teamId),
    meta: {
      inlineError: true,
      invalidates: [queryKeys.invitations, ...tournamentKeys(invitation.tournament.tournament_id, ["teams"])],
      successMessage: successMessage(
        (accepted: Invitation) => `Du bist mit ${accepted.team_name} bei ${accepted.tournament.name} dabei.`,
      ),
    },
  });
}

export function useDeclineInvitation(id: string) {
  return useMutation({
    mutationFn: () => api.invitations.decline(id),
    meta: { invalidates: [queryKeys.invitations] },
  });
}

export function useReopenInvitation(id: string) {
  return useMutation({
    mutationFn: () => api.invitations.reopen(id),
    meta: { invalidates: [queryKeys.invitations], successMessage: "Einladung wieder offen." },
  });
}

// -- the organization

export function useTournamentInvitations(tournamentId: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.tournamentInvitations(tournamentId),
    queryFn: () => api.tournaments.listInvitations(tournamentId),
    enabled: enabled && !!tournamentId,
    meta: { errorMessage: "Die Einladungen konnten nicht geladen werden." },
  });
}

export function useInvitePerson(tournamentId: string) {
  return useMutation({
    mutationFn: (userId: string) => api.tournaments.invitePerson(tournamentId, userId),
    meta: {
      invalidates: [queryKeys.tournamentInvitations(tournamentId)],
      successMessage: successMessage((invitation: TournamentInvitation) => `${invitation.user_name} eingeladen.`),
    },
  });
}

/** Takes an open invitation out of the account of the person. */
export function useWithdrawInvitation(tournamentId: string) {
  return useMutation({
    mutationFn: (invitation: Pick<TournamentInvitation, "id" | "user_name">) =>
      api.tournaments.withdrawInvitation(tournamentId, invitation.id),
    meta: {
      invalidates: [queryKeys.tournamentInvitations(tournamentId), queryKeys.tournamentInvites(tournamentId)],
      successMessage: successMessage(
        (_: unknown, invitation: Pick<TournamentInvitation, "user_name">) => `Einladung an ${invitation.user_name} entfernt.`,
      ),
    },
  });
}
