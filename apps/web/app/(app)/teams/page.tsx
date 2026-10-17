"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Team } from "@/types";
import { Button } from "@/components/ui/button";
import { TeamCard } from "@/components/team-card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TeamDeleteBlockers } from "@/components/delete-team-dialog";
import { useConfirm } from "@/components/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createName, setCreateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Dialog States
  const [renameTeam, setRenameTeam] = useState<Team | null>(null);
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [blockedTeam, setBlockedTeam] = useState<Team | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    void loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const data = await api.teams.list();
      setTeams(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Laden";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;

    setIsCreating(true);
    try {
      await api.teams.create(createName.trim());
      setCreateName("");
      await loadTeams();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Erstellen";
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyInvite = async (team: Team) => {
    try {
      const invite = await api.teams.createInvite(team.id);
      const link = `${window.location.origin}/teams/join/${invite.token}`;
      await navigator.clipboard.writeText(link);
      toast.success("Einladungslink kopiert.");
    } catch (err: unknown) {
      toast.error("Fehler beim Erstellen der Einladung.");
    }
  };

  const handleShareInvite = async (team: Team) => {
    try {
      const invite = await api.teams.createInvite(team.id);
      const link = `${window.location.origin}/teams/join/${invite.token}`;
      if (navigator.share) {
        await navigator.share({
          title: `Komm in mein Team: ${team.name}`,
          text: `Tritt meinem Team "${team.name}" bei Beerpong bei!`,
          url: link,
        });
      } else {
        await navigator.clipboard.writeText(link);
        toast.success("Einladungslink kopiert! (Teilen wird nicht unterstützt)");
      }
    } catch (err: unknown) {
      // User cancelled share or error
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error("Fehler beim Erstellen/Teilen der Einladung.");
      }
    }
  };

  const handleRename = async () => {
    if (!renameTeam || !newName.trim()) return;
    setIsRenaming(true);
    try {
      await api.teams.update(renameTeam.id, newName.trim());
      setRenameTeam(null);
      await loadTeams();
      toast.success("Team erfolgreich umbenannt.");
    } catch (err: unknown) {
      toast.error("Fehler beim Umbenennen.");
    } finally {
      setIsRenaming(false);
    }
  };

  // tournaments in the way: say which; otherwise ask with the consequences
  const handleDelete = (team: Team) => {
    if (team.delete_blockers.length > 0) {
      setBlockedTeam(team);
      return;
    }
    void confirm({
      title: `${team.name} löschen?`,
      description:
        "Das Team verschwindet aus deinen Teams und kann nicht wiederhergestellt werden. Beendete Turniere zeigen es weiter mit seinen Ergebnissen.",
      confirmLabel: "Team löschen",
      destructive: true,
      action: async () => {
        await api.teams.delete(team.id);
        await loadTeams();
        toast.success("Team gelöscht.");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6 pb-20 md:pb-6 space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-20 md:pb-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meine Teams</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <Label htmlFor="team-name" className="sr-only">Name des neuen Teams</Label>
        <Input
          id="team-name"
          placeholder="Neues Team gründen…"
          className="h-11"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          disabled={isCreating}
        />
        <Button type="submit" className="h-11 shrink-0" disabled={isCreating || !createName.trim()}>
          <Plus aria-hidden="true" />
          Gründen
        </Button>
      </form>

      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Keine Teams vorhanden"
          description="Gründe oben dein erstes Team und lade deinen Mitspieler ein."
        />
      ) : (
        <div className="space-y-3">
          {teams.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              onRename={(team) => {
                setNewName(team.name);
                setRenameTeam(team);
              }}
              onDelete={handleDelete}
              onShare={handleShareInvite}
              onCopy={handleCopyInvite}
            />
          ))}
        </div>
      )}

      {/* Rename Dialog */}
      <Dialog open={!!renameTeam} onOpenChange={(o) => !o && setRenameTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Team umbenennen</DialogTitle>
            <DialogDescription>
              Gilt für eure nächsten Turniere. Turniere, die schon gestartet sind, behalten den bisherigen Namen.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rename">Neuer Teamname</Label>
            <Input
              id="rename"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={isRenaming}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTeam(null)} disabled={isRenaming}>
              Abbrechen
            </Button>
            <Button onClick={handleRename} disabled={!newName.trim() || isRenaming}>
              {isRenaming ? "Speichere…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TeamDeleteBlockers team={blockedTeam} onClose={() => setBlockedTeam(null)} />

    </div>
  );
}
