"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { PublicUser, Tournament, TournamentUserRole } from "@/types";
import { TournamentScheduleFields } from "@/components/tournament-schedule-fields";
import { scheduleToPayload, toIsoOrNull, toLocalInput, validateSchedule, type ScheduleValues } from "@/lib/tournament-schedule";
import { TournamentRoleType } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Play, Trash2, Search, UserPlus, UserMinus, ShieldAlert, Link, Copy, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Markdown } from "@/components/markdown";
import { toast } from "sonner";
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

export function TournamentSettings({
  tournament,
  roles,
  userRole,
  onReload,
}: {
  tournament: Tournament;
  roles: TournamentUserRole[];
  userRole: TournamentRoleType | null;
  onReload: () => Promise<void>;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<TournamentRoleType>(TournamentRoleType.REFEREE);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    title: string;
    description?: string;
    action: () => void;
  } | null>(null);

  // Edit details form state
  const [editName, setEditName] = useState(tournament.name);
  const [editLocation, setEditLocation] = useState(tournament.location || "");
  const [editDescription, setEditDescription] = useState(tournament.description || "");
  const [editTableCount, setEditTableCount] = useState(tournament.table_count.toString());
  const [editVisibility, setEditVisibility] = useState(tournament.visibility);
  const initialSchedule: ScheduleValues = {
    start_time: toLocalInput(tournament.start_time),
    registration_end_time: toLocalInput(tournament.registration_end_time),
    registration_auto_close: tournament.registration_auto_close,
    checkin_enabled: tournament.checkin_enabled,
    checkin_start_time: toLocalInput(tournament.checkin_start_time),
    checkin_auto_open: tournament.checkin_auto_open,
  };
  const [schedule, setSchedule] = useState<ScheduleValues>(initialSchedule);
  const scheduleErrors = validateSchedule(schedule);
  const [isUpdating, setIsUpdating] = useState(false);

  const isDirty =
    editName !== tournament.name ||
    editLocation !== (tournament.location || "") ||
    editDescription !== (tournament.description || "") ||
    editTableCount !== tournament.table_count.toString() ||
    editVisibility !== tournament.visibility ||
    (Object.keys(initialSchedule) as (keyof ScheduleValues)[]).some((k) => schedule[k] !== initialSchedule[k]);

  const handleUpdateTournament = async () => {
    setIsUpdating(true);
    try {
      await api.tournaments.update(tournament.id, {
        name: editName,
        location: editLocation || undefined,
        description: editDescription || undefined,
        table_count: parseInt(editTableCount) || 1,
        visibility: editVisibility,
        start_time: toIsoOrNull(schedule.start_time) ?? undefined,
        ...scheduleToPayload(schedule),
      });
      await onReload();
      toast.success("Turnier-Details erfolgreich gespeichert!");
    } catch (err) {
      toast.error("Fehler beim Speichern der Turnier-Details");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    setIsSearching(true);
    try {
      const results = await api.users.search(searchQuery);
      setSearchResults(results);
    } catch (err) {
      toast.error("Fehler bei der Suche");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser) return;
    setIsAssigning(true);
    try {
      await api.roles.assign(tournament.id, selectedUser, selectedRole);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedUser("");
      await onReload();
      toast.success("Rolle erfolgreich zugewiesen!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler";
      toast.error(msg);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleGenerateInvite = async () => {
    setIsGeneratingInvite(true);
    try {
      const res = await api.tournaments.generateInvite(tournament.id);
      const link = `${window.location.origin}/tournaments/${tournament.id}?invite=${res.token}`;
      setInviteLink(link);
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link kopiert!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err: unknown) {
      toast.error("Fehler beim Generieren des Einladungslinks");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleRevokeRole = (roleId: string) => {
    setConfirmState({
      title: "Rolle wirklich entziehen?",
      action: async () => {
        try {
          await api.roles.revoke(tournament.id, roleId);
          await onReload();
          toast.success("Rolle erfolgreich entzogen.");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Fehler";
          toast.error(msg);
        }
      }
    });
  };

  const handleDeleteTournament = () => {
    setConfirmState({
      title: "Möchtest du dieses Turnier wirklich unwiderruflich löschen?",
      action: async () => {
        setIsDeleting(true);
        try {
          await api.tournaments.delete(tournament.id);
          toast.success("Turnier gelöscht.");
          router.push("/tournaments");
        } catch (err) {
          toast.error("Fehler beim Löschen des Turniers");
          setIsDeleting(false);
        }
      }
    });
  };

  const canAssignAdmin = userRole === TournamentRoleType.ADMIN;
  const canAssignManager = userRole === TournamentRoleType.ADMIN;
  const canAssignReferee = userRole === TournamentRoleType.ADMIN || userRole === TournamentRoleType.MANAGER;

  return (
    <div className="space-y-6">
      {(userRole === TournamentRoleType.ADMIN || userRole === TournamentRoleType.MANAGER) && (
        <Card>
          <CardHeader>
            <CardTitle>Turnier-Details bearbeiten</CardTitle>
            <CardDescription>Passe den Namen, Ort und andere Einstellungen an.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Turniername</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ort (Optional)</Label>
                <Input value={editLocation} onChange={e => setEditLocation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Anzahl Tische</Label>
                <Input type="number" min="1" value={editTableCount} onChange={e => setEditTableCount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Sichtbarkeit</Label>
                <Select value={editVisibility} onValueChange={(v: any) => setEditVisibility(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public_listed">Öffentlich (sichtbar für alle)</SelectItem>
                    <SelectItem value="private">Privat (nur mit Link/Einladung)</SelectItem>
                    <SelectItem value="public_unlisted">Versteckt (nur mit Link)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <TournamentScheduleFields
              idPrefix="settings"
              values={schedule}
              errors={scheduleErrors}
              onChange={(patch) => setSchedule((prev) => ({ ...prev, ...patch }))}
              checkinLocked={!!tournament.started_at}
            />
            <div className="space-y-2">
              <Label>Beschreibung (Markdown unterstützt)</Label>
              <Tabs defaultValue="edit" className="w-full">
                <TabsList className="mb-2">
                  <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
                  <TabsTrigger value="preview">Vorschau</TabsTrigger>
                </TabsList>
                <TabsContent value="edit">
                  <Textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    rows={5}
                    placeholder="Turnier-Regeln, Zeitplan, Preise..."
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="p-4 bg-muted/30 border rounded-md min-h-[120px]">
                    {editDescription ? (
                      <Markdown>{editDescription}</Markdown>
                    ) : (
                      <span className="text-muted-foreground italic">Keine Beschreibung...</span>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <Button onClick={handleUpdateTournament} disabled={isUpdating || !editName.trim() || !schedule.start_time || Object.keys(scheduleErrors).length > 0 || !isDirty}>
              {isUpdating ? "Speichern..." : (isDirty ? "Änderungen speichern" : "Gespeichert")}
            </Button>
          </CardContent>
        </Card>
      )}

      {tournament.visibility === "private" && (userRole === TournamentRoleType.ADMIN || userRole === TournamentRoleType.MANAGER) && (
        <Card>
          <CardHeader>
            <CardTitle>Einladungslink (Privates Turnier)</CardTitle>
            <CardDescription>
              Da dieses Turnier privat ist, können Teams nur mit einem Einladungslink beitreten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateInvite}
                disabled={isGeneratingInvite}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                {isGeneratingInvite ? (
                  "Generiere..."
                ) : copied ? (
                  <><Check className="mr-2 h-4 w-4" /> Kopiert</>
                ) : (
                  <><Link className="mr-2 h-4 w-4" /> Link generieren & kopieren</>
                )}
              </Button>
            </div>
            {inviteLink && (
              <div className="mt-4 p-3 bg-muted rounded-md text-sm break-all font-mono">
                {inviteLink}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rollen & Berechtigungen</CardTitle>
          <CardDescription>Verwalte, wer das Turnier bearbeiten oder Ergebnisse eintragen darf.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Rolle zuweisen</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Nutzername suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="secondary" onClick={handleSearch} disabled={isSearching || searchQuery.length < 2}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3 bg-muted/20 p-3 rounded-lg border">
                <div className="space-y-2">
                  <Label>Nutzer auswählen</Label>
                  <Select value={selectedUser} onValueChange={(v) => v && setSelectedUser(v as string)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nutzer wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {searchResults.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rolle auswählen</Label>
                  <Select value={selectedRole} onValueChange={(v) => v && setSelectedRole(v as TournamentRoleType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Rolle wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {canAssignAdmin && <SelectItem value={TournamentRoleType.ADMIN}>Admin</SelectItem>}
                      {canAssignManager && <SelectItem value={TournamentRoleType.MANAGER}>Manager</SelectItem>}
                      {canAssignReferee && <SelectItem value={TournamentRoleType.REFEREE}>Schiedsrichter</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleAssignRole} disabled={!selectedUser || isAssigning}>
                  <UserPlus className="h-4 w-4 mr-2" /> Zuweisen
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t">
            <h3 className="font-medium text-sm">Aktuelle Berechtigungen</h3>
            <div className="space-y-2">
              {roles.map(r => (
                <div key={r.id} className="flex justify-between items-center p-2 border rounded-md bg-background">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{r.user_name || r.user_id}</span>
                    <span className="text-xs text-muted-foreground uppercase">{r.role}</span>
                  </div>
                  {(userRole === TournamentRoleType.ADMIN || (userRole === TournamentRoleType.MANAGER && r.role === TournamentRoleType.REFEREE)) && (
                    <Button variant="ghost" size="sm" onClick={() => handleRevokeRole(r.id)}>
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {userRole === TournamentRoleType.ADMIN && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Gefahrenzone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleDeleteTournament} disabled={isDeleting}>
              <Trash2 className="mr-2 h-4 w-4" /> Turnier endgültig löschen
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!confirmState} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            {confirmState?.description && <AlertDialogDescription>{confirmState?.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmState?.action()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Bestätigen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
