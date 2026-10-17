"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/confirm-dialog";
import type { TournamentInvite } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

const teamsText = (n: number) => (n === 1 ? "1 Team" : `${n} Teams`);

/** The invitation links of a tournament: create them (with a name for the channel), copy, share, delete. */
export function InviteLinks({ tournamentId }: Readonly<{ tournamentId: string }>) {
  const [invites, setInvites] = useState<TournamentInvite[] | null>(null);
  const [label, setLabel] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      setInvites(await api.tournaments.listInvites(tournamentId));
    } catch {
      toast.error("Die Einladungslinks konnten nicht geladen werden.");
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await api.tournaments.createInvite(tournamentId, label.trim());
      setLabel("");
      await load();
    } catch {
      toast.error("Der Link konnte nicht erstellt werden.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (invite: TournamentInvite) => {
    await navigator.clipboard.writeText(inviteUrl(invite.token));
    toast.success("Link kopiert");
  };

  const handleShare = async (invite: TournamentInvite) => {
    try {
      await navigator.share({ title: "Einladung zum Turnier", url: inviteUrl(invite.token) });
    } catch {
      // closed without sharing
    }
  };

  const handleDelete = (invite: TournamentInvite) => {
    void confirm({
      title: "Link löschen?",
      description: "Wer den Link noch hat, kann damit nicht mehr beitreten. Teams, die schon beigetreten sind, bleiben im Turnier.",
      confirmLabel: "Link löschen",
      destructive: true,
      action: async () => {
        await api.tournaments.deleteInvite(tournamentId, invite.id);
        await load();
      },
    });
  };

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="space-y-4">
      {invites?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Es gibt keinen Einladungslink. Ohne Link kann niemand mehr beitreten.
        </p>
      )}
      <ul className="divide-y rounded-xl border">
        {invites?.map((invite) => (
          <li key={invite.id} className="flex items-center gap-2 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium leading-tight">{invite.label ?? "Einladungslink"}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">/invite/{invite.token}</p>
              <p className="text-xs text-muted-foreground">{teamsText(invite.uses)} beigetreten</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-10 shrink-0"
              onClick={() => handleCopy(invite)}
              aria-label={`Link ${invite.label ?? invite.token} kopieren`}
            >
              <Copy aria-hidden="true" />
            </Button>
            {canShare && (
              <Button
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                onClick={() => handleShare(invite)}
                aria-label={`Link ${invite.label ?? invite.token} teilen`}
              >
                <Share2 aria-hidden="true" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleDelete(invite)}
              aria-label={`Link ${invite.label ?? invite.token} löschen`}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreate} className="space-y-2">
        <Label htmlFor="invite-label">Neuer Link</Label>
        <div className="flex gap-2">
          <Input
            id="invite-label"
            placeholder="Name, z. B. WhatsApp"
            maxLength={60}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={isCreating}
          />
          <Button type="submit" className="shrink-0" disabled={isCreating}>
            Link erstellen
          </Button>
        </div>
      </form>

    </div>
  );
}
