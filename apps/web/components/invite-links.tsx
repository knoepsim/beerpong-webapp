"use client";

import { useState } from "react";
import { ChevronDown, Copy, Share2, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { InvitationRow } from "@/components/invitation-status";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTournamentInvitations } from "@/hooks/queries/invitations";
import { useCreateTournamentInvite, useDeleteTournamentInvite, useTournamentInvites } from "@/hooks/queries/tournaments";
import { copyLink, shareOrCopy } from "@/lib/share";
import { cn } from "@/lib/utils";
import type { TournamentInvitation, TournamentInvite } from "@/types";

export const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

const nameOf = (invite: TournamentInvite) => invite.label ?? "Einladungslink";
/** "Link WhatsApp" for a named link, "Einladungslink" for one without a name. */
const titleOf = (invite: TournamentInvite) => (invite.label ? `Link ${invite.label}` : "Einladungslink");

function countText(invite: TournamentInvite): string {
  if (invite.opened === 0) return "Noch nicht geöffnet";
  return `${invite.opened} geöffnet · ${invite.joined} dabei`;
}

function deleteConsequences(pending: number): string {
  const parts = ["Wer den Link noch hat, wird damit nicht mehr eingeladen."];
  if (pending === 1) parts.push("1 offene Einladung bleibt im Konto; du kannst sie einzeln entfernen.");
  if (pending > 1) parts.push(`${pending} offene Einladungen bleiben im Konto; du kannst sie einzeln entfernen.`);
  parts.push("Teams, die schon dabei sind, bleiben im Turnier.");
  return parts.join(" ");
}

/** One link: copy, share, delete; open it to see the accounts that opened it and how far they are. */
function LinkRow({
  tournamentId,
  invite,
  invitations,
}: Readonly<{ tournamentId: string; invite: TournamentInvite; invitations: TournamentInvitation[] }>) {
  const confirm = useConfirm();
  const remove = useDeleteTournamentInvite(tournamentId);
  const name = nameOf(invite);
  const title = titleOf(invite);

  const handleDelete = () =>
    void confirm({
      title: `${title} löschen?`,
      description: deleteConsequences(invitations.filter((i) => i.status === "pending").length),
      confirmLabel: "Link löschen",
      destructive: true,
      action: async () => {
        await remove.mutateAsync(invite.id);
      },
    });

  return (
    <li className="py-1">
      <Collapsible>
        <div className="flex items-center gap-1">
          <CollapsibleTrigger className="group flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <ChevronDown
              className="size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform group-data-[panel-open]:rotate-0 motion-reduce:transition-none"
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className={cn("block truncate font-medium", invite.deleted && "text-muted-foreground line-through")}>
                {name}
              </span>
              <span className="block text-xs text-muted-foreground">
                {invite.deleted ? `Gelöscht · ${countText(invite)}` : countText(invite)}
              </span>
            </span>
          </CollapsibleTrigger>
          {!invite.deleted && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                onClick={() => void copyLink(inviteUrl(invite.token))}
                aria-label={`${title} kopieren`}
              >
                <Copy aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                onClick={() => void shareOrCopy({ title: "Einladung zum Turnier", url: inviteUrl(invite.token) })}
                aria-label={`${title} teilen`}
              >
                <Share2 aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete}
                aria-label={`${title} löschen`}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
        <CollapsibleContent>
          {invitations.length === 0 ? (
            <p className="ml-7 py-2 text-sm text-muted-foreground">Noch niemand hat den Link mit einem Konto geöffnet.</p>
          ) : (
            <ul className="ml-3 border-l pl-4">
              {invitations.map((invitation) => (
                <InvitationRow key={invitation.id} tournamentId={tournamentId} invitation={invitation} />
              ))}
            </ul>
          )}
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

/**
 * The invitation links of a tournament: create them (with a name for the channel), copy, share, delete; each shows
 * the accounts that opened it. Deleted links stay at the end with what they brought.
 */
export function InviteLinks({ tournamentId }: Readonly<{ tournamentId: string }>) {
  const { data: invites, error, refetch } = useTournamentInvites(tournamentId);
  const invitations = useTournamentInvitations(tournamentId).data ?? [];
  const create = useCreateTournamentInvite(tournamentId);
  const [label, setLabel] = useState("");

  if (error && !invites) {
    return (
      <LoadError error={error} fallback="Die Einladungslinks konnten nicht geladen werden." onRetry={() => void refetch()} />
    );
  }

  const ordered = [...(invites ?? [])].sort((a, b) => Number(a.deleted) - Number(b.deleted));

  return (
    <div className="space-y-4">
      {invites?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Noch kein Link. Jeder Link zeigt dir, wer ihn geöffnet hat; lege für jeden Kanal einen eigenen an.
        </p>
      )}
      {ordered.length > 0 && (
        <ul className="divide-y">
          {ordered.map((invite) => (
            <LinkRow
              key={invite.id}
              tournamentId={tournamentId}
              invite={invite}
              invitations={invitations.filter((i) => i.invite_id === invite.id)}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(label.trim(), { onSuccess: () => setLabel("") });
        }}
        className="space-y-2"
      >
        <Label htmlFor="invite-label">Neuer Link</Label>
        <div className="flex gap-2">
          <Input
            id="invite-label"
            placeholder="Name, z. B. WhatsApp"
            maxLength={60}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={create.isPending}
          />
          <Button type="submit" className="shrink-0" disabled={create.isPending}>
            Link erstellen
          </Button>
        </div>
      </form>
    </div>
  );
}
