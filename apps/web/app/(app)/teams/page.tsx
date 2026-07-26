"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Team } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Users, Plus, MoreVertical, Pencil, Trash, User as UserIcon, Copy, Share } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

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

  const [deleteTeam, setDeleteTeam] = useState<Team | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTeams();
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
      setInviteLinks(prev => ({ ...prev, [team.id]: link }));
    } catch (err: unknown) {
      alert("Fehler beim Erstellen der Einladung.");
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
        alert("Einladungslink wurde in die Zwischenablage kopiert! (Teilen wird auf diesem Gerät nicht unterstützt)");
      }
    } catch (err: unknown) {
      // User cancelled share or error
      if (err instanceof Error && err.name !== 'AbortError') {
        alert("Fehler beim Erstellen/Teilen der Einladung.");
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
    } catch (err: unknown) {
      alert("Fehler beim Umbenennen.");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTeam) return;
    setIsDeleting(true);
    try {
      await api.teams.delete(deleteTeam.id);
      setDeleteTeam(null);
      await loadTeams();
    } catch (err: unknown) {
      alert("Fehler beim Löschen.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getInitials = (name: string) => {
    const letters = name.replace(/[^a-zA-ZäöüÄÖÜß]/g, "");
    if (!letters) return null;
    return letters.substring(0, 2).toUpperCase();
  };

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Lade Teams…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-20 md:pb-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Deine Teams</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base">Neues Team gründen</CardTitle>
          <CardDescription className="text-xs">
            Erstelle ein Team und lade anschließend deine Mitspieler ein.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1 hidden sm:block">
              <Label htmlFor="team-name" className="sr-only">Team Name</Label>
              <Input
                id="team-name"
                placeholder="Name deines Teams…"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                disabled={isCreating}
              />
            </div>
            <div className="flex-1 space-y-2 sm:hidden">
              <Label htmlFor="team-name-mobile">Team Name</Label>
              <Input
                id="team-name-mobile"
                placeholder="Name deines Teams…"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                disabled={isCreating}
              />
            </div>
            <Button type="submit" size="sm" disabled={isCreating || !createName.trim()} className="sm:mt-0 mt-2">
              <Plus className="mr-2 h-4 w-4" />
              Erstellen
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {teams.length === 0 ? (
          <EmptyState 
            icon={Users} 
            title="Keine Teams vorhanden" 
            description="Du bist noch in keinem Team. Gründe oben ein neues Team, um loszulegen."
          />
        ) : teams.map((t) => (
            <Card key={t.id} className="relative">
              <div className="absolute top-1.5 right-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7 text-muted-foreground hover:text-foreground")}>
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={!t.is_renamable}
                      onClick={() => {
                        setNewName(t.name);
                        setRenameTeam(t);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Umbenennen
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!t.is_deletable}
                      className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                      onClick={() => setDeleteTeam(t)}
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <CardHeader className="py-2 px-3">
                <CardTitle className="text-base pr-6">{t.name}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="flex flex-col gap-2">
                  {t.members.map((m) => {
                    const initials = getInitials(m.name);
                    return (
                      <div key={m.user_id} className="flex items-center gap-2">
                        <Avatar className="h-8 w-8 border-2 border-primary/20">
                          <AvatarFallback className="bg-primary/5 text-primary text-xs font-semibold">
                            {initials ? initials : <UserIcon className="h-4 w-4" />}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{m.name}</span>
                      </div>
                    );
                  })}
                  {!t.is_complete && (
                    <div className="flex flex-col gap-1.5 mt-1 pt-2 border-t border-border/50">
                      <span className="text-[11px] leading-tight text-muted-foreground">Einladung verschicken.</span>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => handleCopyInvite(t)}>
                          <Copy className="h-3 w-3 mr-1.5" />
                          Kopieren
                        </Button>
                        <Button variant="default" size="sm" className="h-7 px-2 text-xs" onClick={() => handleShareInvite(t)}>
                          <Share className="h-3 w-3 mr-1.5" />
                          Teilen
                        </Button>
                      </div>
                      {inviteLinks[t.id] && (
                        <div className="mt-1">
                          <Input
                            readOnly
                            value={inviteLinks[t.id]}
                            className="h-8 text-xs bg-muted/50 font-mono"
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Rename Dialog */}
      <Dialog open={!!renameTeam} onOpenChange={(o) => !o && setRenameTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Team umbenennen</DialogTitle>
            <DialogDescription>
              Gib einen neuen Namen für dein Team ein.
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
              {isRenaming ? "Speichere..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTeam} onOpenChange={(o) => !o && setDeleteTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Team wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Das Team wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Lösche..." : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
