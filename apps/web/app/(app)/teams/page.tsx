"use client";

import { useState } from "react";
import {
  useCreateTeam,
  useDeleteTeam,
  useMyTeams,
  useRenameTeam,
} from "@/hooks/queries/teams";
import { errorMessage } from "@/lib/errors";
import { useTeamInviteLink } from "@/hooks/use-team-invite-link";
import { LoadError } from "@/components/load-error";
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
import { EmptyNote } from "@/components/empty-note";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamsPage() {
  const teamsQuery = useMyTeams();
  const teams = teamsQuery.data ?? [];
  const create = useCreateTeam();
  const rename = useRenameTeam();
  const remove = useDeleteTeam();
  const inviteLink = useTeamInviteLink();

  const [createName, setCreateName] = useState("");
  const [renameTeam, setRenameTeam] = useState<Team | null>(null);
  const [newName, setNewName] = useState("");
  const [blockedTeam, setBlockedTeam] = useState<Team | null>(null);
  const confirm = useConfirm();

  const handleCreate = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!createName.trim()) return;
    create.mutate(createName.trim(), { onSuccess: () => setCreateName("") });
  };

  const openRename = (team: Team) => {
    rename.reset();
    setNewName(team.name);
    setRenameTeam(team);
  };

  const handleRename = () => {
    if (!renameTeam || !newName.trim()) return;
    rename.mutate({ id: renameTeam.id, name: newName.trim() }, { onSuccess: () => setRenameTeam(null) });
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
        await remove.mutateAsync(team.id);
      },
    });
  };

  if (teamsQuery.isPending) {
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

      <form onSubmit={handleCreate} className="space-y-2">
        <div className="flex gap-2">
          <Label htmlFor="team-name" className="sr-only">Name des neuen Teams</Label>
          <Input
            id="team-name"
            placeholder="Neues Team gründen…"
            className="h-11"
            value={createName}
            onChange={(e) => {
              setCreateName(e.target.value);
              create.reset();
            }}
            disabled={create.isPending}
            aria-invalid={create.isError}
            aria-describedby={create.isError ? "team-name-error" : undefined}
          />
          <Button type="submit" className="h-11 shrink-0" disabled={create.isPending || !createName.trim()}>
            <Plus aria-hidden="true" />
            Gründen
          </Button>
        </div>
        {create.isError && (
          <p id="team-name-error" className="text-sm text-destructive">
            {errorMessage(create.error)}
          </p>
        )}
      </form>

      {teamsQuery.isError && (
        <LoadError
          error={teamsQuery.error}
          fallback="Deine Teams konnten nicht geladen werden."
          onRetry={() => void teamsQuery.refetch()}
        />
      )}
      {teamsQuery.isSuccess && teams.length === 0 && (
        <EmptyNote
          icon={Users}
          title="Gründe dein erstes Team"
          description="Gib oben einen Namen ein und lade danach deinen Mitspieler ein."
        />
      )}
      {teams.length > 0 && (
        <div className="space-y-3">
          {teams.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              onRename={openRename}
              onDelete={handleDelete}
              onShare={inviteLink.share}
              onCopy={inviteLink.copy}
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
              disabled={rename.isPending}
              aria-invalid={rename.isError}
            />
            {rename.isError && <p className="mt-2 text-sm text-destructive">{errorMessage(rename.error)}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTeam(null)} disabled={rename.isPending}>
              Abbrechen
            </Button>
            <Button onClick={handleRename} disabled={!newName.trim() || rename.isPending}>
              {rename.isPending ? "Wird gespeichert…" : "Namen speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TeamDeleteBlockers team={blockedTeam} onClose={() => setBlockedTeam(null)} />

    </div>
  );
}
