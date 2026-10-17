"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Lock, UserPlus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcceptInvitation, useDeclineInvitation, useReopenInvitation } from "@/hooks/queries/invitations";
import { useCreateTeam, useMyTeams } from "@/hooks/queries/teams";
import { useTeamInviteLink } from "@/hooks/use-team-invite-link";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { Invitation, Team } from "@/types";

const membersText = (team: Team) => team.members.map((m) => m.name).join(" · ");

/** The teams to answer with, as cards to tap (radio buttons: one team). */
function TeamChoice({ teams, value, onChange }: Readonly<{ teams: Team[]; value: string; onChange: (id: string) => void }>) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-medium">Mit welchem Team?</legend>
      {teams.map((team) => (
        <label
          key={team.id}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
            value === team.id && "border-primary ring-1 ring-primary",
          )}
        >
          <input
            type="radio"
            name="invitation-team"
            value={team.id}
            checked={value === team.id}
            onChange={() => onChange(team.id)}
            className="size-4 accent-primary"
          />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{team.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{membersText(team)}</span>
          </span>
          {!team.is_complete && (
            <span className="shrink-0 rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-xs font-medium">
              {team.members.length} von {team.max_size}
            </span>
          )}
        </label>
      ))}
    </fieldset>
  );
}

/** A new team right here, without leaving the invitation. */
function NewTeamForm({ onCreated }: Readonly<{ onCreated: (team: Team) => void }>) {
  const [name, setName] = useState("");
  const create = useCreateTeam();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) create.mutate(name.trim(), { onSuccess: onCreated });
      }}
    >
      <Label htmlFor="invitation-team-name">Name deines Teams</Label>
      <div className="flex gap-2">
        <Input
          id="invitation-team-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            create.reset();
          }}
          placeholder="z. B. Becherhelden"
          className="h-11"
          aria-invalid={create.isError}
          disabled={create.isPending}
        />
        <Button type="submit" className="h-11 shrink-0" disabled={!name.trim() || create.isPending}>
          Team gründen
        </Button>
      </div>
      {create.isError && <p className="text-sm text-destructive">{errorMessage(create.error)}</p>}
    </form>
  );
}

/** Accept with a team (or get one ready first), or decline. */
function PendingAnswer({ invitation }: Readonly<{ invitation: Invitation }>) {
  const router = useRouter();
  const teamsQuery = useMyTeams({ fresh: true });
  const accept = useAcceptInvitation(invitation);
  const decline = useDeclineInvitation(invitation.id);
  const reopen = useReopenInvitation(invitation.id);
  const inviteLink = useTeamInviteLink();
  const [teamId, setTeamId] = useState("");
  const [newTeam, setNewTeam] = useState(false);
  const teams = teamsQuery.data ?? [];
  // a complete team is the likely answer
  const chosen = teams.find((t) => t.id === teamId) ?? teams.find((t) => t.is_complete) ?? teams[0];

  const handleDecline = () =>
    decline
      .mutateAsync()
      .then(() => {
        toast.success(`Einladung zu ${invitation.tournament.name} abgelehnt.`, {
          action: { label: "Rückgängig", onClick: () => reopen.mutate() },
        });
        router.push("/tournaments");
      })
      .catch(() => undefined); // the toast of the mutation says why

  if (teamsQuery.isPending) return <Skeleton className="h-28 w-full" />;

  return (
    <div className="space-y-4">
      {teams.length > 0 && chosen && <TeamChoice teams={teams} value={chosen.id} onChange={setTeamId} />}

      {chosen?.is_complete && (
        <Button
          size="lg"
          className="h-12 w-full"
          disabled={accept.isPending}
          // awaited, not an onSuccess of mutate: the invitation is loaded again as accepted before, and this part of
          // the page is gone by then
          onClick={() =>
            accept
              .mutateAsync(chosen.id)
              .then(() => router.replace(`/t/${invitation.tournament.slug}`))
              .catch(() => undefined) // shown at the button
          }
        >
          {accept.isPending ? "Wird angenommen…" : `Mit ${chosen.name} beitreten`}
        </Button>
      )}
      {accept.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(accept.error)}
        </p>
      )}

      {chosen && !chosen.is_complete && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {chosen.name} braucht noch einen Mitspieler. Die Einladung wartet so lange unter Meine Turniere.
          </p>
          <Button className="h-11 w-full" disabled={inviteLink.isPending} onClick={() => void inviteLink.share(chosen)}>
            <UserPlus aria-hidden="true" />
            Mitspieler einladen
          </Button>
        </div>
      )}

      {teams.length === 0 || newTeam ? (
        <NewTeamForm
          onCreated={(team) => {
            setTeamId(team.id);
            setNewTeam(false);
          }}
        />
      ) : (
        !chosen?.is_complete && (
          <Button variant="outline" className="h-11 w-full" onClick={() => setNewTeam(true)}>
            Neues Team gründen
          </Button>
        )
      )}

      {/* far from the primary action */}
      <div className="border-t pt-3 text-center">
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={handleDecline}
          disabled={decline.isPending}
        >
          Einladung ablehnen
        </Button>
      </div>
    </div>
  );
}

/** What the invited person can do now: answer, or see what the answer was. */
export function InvitationAnswer({ invitation }: Readonly<{ invitation: Invitation }>) {
  const reopen = useReopenInvitation(invitation.id);
  const { tournament } = invitation;

  if (invitation.status === "accepted") {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
          Du bist mit {invitation.team_name} dabei.
        </p>
        <Link href={`/t/${tournament.slug}`} className={cn(buttonVariants({ size: "lg" }), "h-12 w-full")}>
          Zum Turnier
        </Link>
      </div>
    );
  }
  if (invitation.status === "withdrawn") {
    return <p className="text-sm text-muted-foreground">Diese Einladung wurde zurückgezogen.</p>;
  }
  if (!tournament.registration_open) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium">
        <Lock className="size-4" aria-hidden="true" />
        Die Anmeldung ist geschlossen.
      </p>
    );
  }
  if (invitation.status === "declined") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Du hast diese Einladung abgelehnt.</p>
        <Button variant="outline" className="h-11 w-full" onClick={() => reopen.mutate()} disabled={reopen.isPending}>
          Doch antworten
        </Button>
      </div>
    );
  }
  return <PendingAnswer invitation={invitation} />;
}

/** Who invites, in one line under the name. */
export function invitationFrom(invitation: Pick<Invitation, "invited_by_name">): string {
  return invitation.invited_by_name ? `${invitation.invited_by_name} lädt dich ein` : "Du bist eingeladen";
}
