"use client";

import { InvitationRow, InvitationStatusPill } from "@/components/invitation-status";
import { Button } from "@/components/ui/button";
import { PersonSearch } from "@/components/person-search";
import { useInvitePerson, useTournamentInvitations } from "@/hooks/queries/invitations";
import type { PublicUser, TournamentInvitation } from "@/types";

/** What can be done with a person found: invite, or what they are already. */
function InviteAction({
  person,
  invitation,
  plays,
  onInvite,
  inviting,
}: Readonly<{
  person: PublicUser;
  invitation: TournamentInvitation | undefined;
  plays: boolean;
  onInvite: () => void;
  inviting: boolean;
}>) {
  if (plays) {
    return <span className="rounded-full border border-success/50 bg-success/10 px-2 py-0.5 text-xs font-medium">Dabei</span>;
  }
  if (invitation?.status === "pending" || invitation?.status === "accepted") {
    return <InvitationStatusPill invitation={invitation} />;
  }
  // nobody, declined or removed: inviting (again) is possible
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-9"
      onClick={onInvite}
      disabled={inviting}
      aria-label={`${person.name} ${invitation ? "erneut einladen" : "einladen"}`}
    >
      {invitation ? "Erneut einladen" : "Einladen"}
    </Button>
  );
}

/** Invite a person directly (the search is the same as for roles), then everybody invited directly, with their state. */
export function InvitePerson({
  tournamentId,
  participantIds,
}: Readonly<{ tournamentId: string; participantIds: Set<string> }>) {
  const invitations = useTournamentInvitations(tournamentId).data ?? [];
  const invite = useInvitePerson(tournamentId);
  const byUser = new Map(invitations.map((i) => [i.user_id, i]));
  const direct = invitations.filter((i) => i.invite_id === null || i.invited_by_name);

  return (
    <div className="space-y-4">
      <PersonSearch
        id="invite-search"
        notFound="Niemand gefunden. Ein Einladungslink erreicht auch Leute ohne Konto."
        renderAction={(person) => (
          <InviteAction
            person={person}
            invitation={byUser.get(person.id)}
            plays={participantIds.has(person.id)}
            onInvite={() => invite.mutate(person.id)}
            inviting={invite.isPending}
          />
        )}
      />

      {direct.length > 0 && (
        <section aria-labelledby="direct-invitations" className="space-y-1">
          <h3 id="direct-invitations" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Direkt eingeladen · {direct.length}
          </h3>
          <ul className="divide-y">
            {direct.map((invitation) => (
              <InvitationRow key={invitation.id} tournamentId={tournamentId} invitation={invitation} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
