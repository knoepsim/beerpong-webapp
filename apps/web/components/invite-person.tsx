"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { InvitationRow, InvitationStatusPill } from "@/components/invitation-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInvitePerson, useTournamentInvitations } from "@/hooks/queries/invitations";
import { useUserSearch } from "@/hooks/queries/user";
import { errorMessage } from "@/lib/errors";
import type { PublicUser, TournamentInvitation } from "@/types";

/** What can be done with a person found: invite, or what they are already. */
function SearchResult({
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
  let state: React.ReactNode;
  if (plays) {
    state = <span className="rounded-full border border-success/50 bg-success/10 px-2 py-0.5 text-xs font-medium">Dabei</span>;
  } else if (invitation?.status === "pending" || invitation?.status === "accepted") {
    state = <InvitationStatusPill invitation={invitation} />;
  } else {
    // nobody, declined or removed: inviting (again) is possible
    state = (
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
  return (
    <li className="flex min-h-11 items-center gap-2 py-1">
      <span className="min-w-0 flex-1 truncate">{person.name}</span>
      {state}
    </li>
  );
}

/**
 * Invite a person directly: the same search as for roles (a part of the name, a whole phone number or e-mail
 * address), then everybody who was invited directly, with how far they are.
 */
export function InvitePerson({
  tournamentId,
  participantIds,
}: Readonly<{ tournamentId: string; participantIds: Set<string> }>) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const search = useUserSearch(submitted);
  const invitations = useTournamentInvitations(tournamentId).data ?? [];
  const invite = useInvitePerson(tournamentId);
  const byUser = new Map(invitations.map((i) => [i.user_id, i]));
  const direct = invitations.filter((i) => i.invite_id === null || i.invited_by_name);

  const handleSearch = () => {
    if (query.trim().length < 2) return;
    if (query.trim() === submitted) void search.refetch();
    else setSubmitted(query.trim());
  };

  return (
    <div className="space-y-4">
      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <Label htmlFor="invite-search">Person suchen</Label>
        <div className="flex gap-2">
          <Input
            id="invite-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, Handynummer oder E-Mail"
            autoComplete="off"
            aria-describedby="invite-search-hint"
          />
          <Button type="submit" variant="secondary" className="shrink-0" disabled={query.trim().length < 2 || search.isFetching}>
            <Search aria-hidden="true" />
            Suchen
          </Button>
        </div>
        <p id="invite-search-hint" className="text-xs text-muted-foreground">
          Teil des Namens, oder die ganze Nummer bzw. E-Mail-Adresse.
        </p>
      </form>

      {search.isError && <p className="text-sm text-destructive">{errorMessage(search.error)}</p>}
      {search.isSuccess && search.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Niemand gefunden. Ein Einladungslink erreicht auch Leute ohne Konto.</p>
      )}
      {search.data && search.data.length > 0 && (
        <ul className="rounded-lg bg-muted/50 px-3">
          {search.data.map((person) => (
            <SearchResult
              key={person.id}
              person={person}
              invitation={byUser.get(person.id)}
              plays={participantIds.has(person.id)}
              onInvite={() => invite.mutate(person.id)}
              inviting={invite.isPending}
            />
          ))}
        </ul>
      )}

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
