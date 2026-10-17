"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { PublicUser, Tournament, TournamentUserRole } from "@/types";
import { AccessFields } from "@/components/access-fields";
import { InviteLinks } from "@/components/invite-links";
import { useConfirm } from "@/components/confirm-dialog";
import { TableManager } from "@/components/table-manager";
import { TournamentScheduleFields } from "@/components/tournament-schedule-fields";
import { scheduleToPayload, toIsoOrNull, toLocalInput, validateSchedule, type ScheduleValues } from "@/lib/tournament-schedule";
import { JoinPolicy, TournamentRoleType } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Play, Trash2, Search, UserPlus, UserMinus, ShieldAlert } from "lucide-react";
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

/** A group of settings with its own save button right below its fields (what belongs together is saved together). */
function SettingsCard({
  title,
  description,
  dirty,
  saving,
  invalid = false,
  onSave,
  children,
}: Readonly<{
  title: string;
  description: string;
  dirty: boolean;
  saving: boolean;
  invalid?: boolean;
  onSave: () => void;
  children: ReactNode;
}>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <Button onClick={onSave} disabled={saving || invalid || !dirty}>
          {saving ? "Wird gespeichert..." : dirty ? `${title} speichern` : "Gespeichert"}
        </Button>
      </CardContent>
    </Card>
  );
}

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
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<TournamentRoleType>(TournamentRoleType.REFEREE);
  const [isAssigning, setIsAssigning] = useState(false);



  // Edit details form state
  const [editName, setEditName] = useState(tournament.name);
  const [editLocation, setEditLocation] = useState(tournament.location || "");
  const [editDescription, setEditDescription] = useState(tournament.description || "");
  const [editVisibility, setEditVisibility] = useState(tournament.visibility);
  const [editJoinPolicy, setEditJoinPolicy] = useState(tournament.join_policy);
  const [editSlug, setEditSlug] = useState(tournament.slug);
  const [slugError, setSlugError] = useState<string | null>(null);
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
  const [saving, setSaving] = useState<"general" | "schedule" | "access" | null>(null);

  // the schedule and who may join only matter before the start: afterwards they are not shown (the API keeps them too)
  const started = !!tournament.started_at;
  const generalDirty =
    editName !== tournament.name ||
    editLocation !== (tournament.location || "") ||
    editDescription !== (tournament.description || "");
  const scheduleDirty = (Object.keys(initialSchedule) as (keyof ScheduleValues)[]).some(
    (k) => schedule[k] !== initialSchedule[k],
  );
  const accessDirty =
    editVisibility !== tournament.visibility || editJoinPolicy !== tournament.join_policy || editSlug !== tournament.slug;

  /** Each card saves only its own fields. */
  const save = async (group: "general" | "schedule" | "access") => {
    const payloads: Record<typeof group, Parameters<typeof api.tournaments.update>[1]> = {
      general: { name: editName, location: editLocation || undefined, description: editDescription || undefined },
      schedule: { start_time: toIsoOrNull(schedule.start_time) ?? undefined, ...scheduleToPayload(schedule) },
      access: { slug: editSlug, visibility: editVisibility, ...(started ? {} : { join_policy: editJoinPolicy }) },
    };
    setSaving(group);
    try {
      setSlugError(null);
      const saved = await api.tournaments.update(tournament.id, payloads[group]);
      toast.success("Gespeichert");
      // a changed address is the new page of the tournament
      if (saved.slug !== tournament.slug) router.replace(`/t/${saved.slug}`);
      else await onReload();
    } catch (err) {
      if (err instanceof ApiError && (err.data?.error_code === "SLUG_TAKEN" || err.data?.error_code === "INVALID_SLUG")) {
        setSlugError(err.message);
      } else {
        toast.error(err instanceof Error ? err.message : "Das hat nicht geklappt. Versuch es noch einmal.");
      }
    } finally {
      setSaving(null);
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

  const handleRevokeRole = (role: TournamentUserRole) => {
    const who = role.user_name || "Diese Person";
    void confirm({
      title: "Rolle entziehen?",
      description: `${who} kann das Turnier danach nicht mehr ${role.role === TournamentRoleType.REFEREE ? "als Schiedsrichter leiten" : "verwalten"}.`,
      confirmLabel: "Rolle entziehen",
      destructive: true,
      action: async () => {
        await api.roles.revoke(tournament.id, role.id);
        await onReload();
        toast.success("Rolle entzogen.");
      },
    });
  };

  const handleDeleteTournament = () => {
    void confirm({
      title: `${tournament.name} löschen?`,
      description: "Das Turnier mit allen Anmeldungen, Spielen und Ergebnissen ist danach für alle weg. Das lässt sich nicht rückgängig machen.",
      confirmLabel: "Turnier löschen",
      destructive: true,
      typeToConfirm: tournament.name,
      action: async () => {
        await api.tournaments.delete(tournament.id);
        toast.success("Turnier gelöscht.");
        router.push("/tournaments");
      },
    });
  };

  const canManage = (userRole === TournamentRoleType.ADMIN || userRole === TournamentRoleType.MANAGER);
  const canAssignAdmin = userRole === TournamentRoleType.ADMIN;
  const canAssignManager = userRole === TournamentRoleType.ADMIN;
  const canAssignReferee = userRole === TournamentRoleType.ADMIN || userRole === TournamentRoleType.MANAGER;

  return (
    <div className="space-y-6">
      {canManage && (
        <SettingsCard
          title="Allgemein"
          description="Was alle auf der Turnierseite lesen."
          dirty={generalDirty}
          saving={saving === "general"}
          invalid={!editName.trim()}
          onSave={() => save("general")}
        >
          <div className="space-y-2">
            <Label htmlFor="settings-name">Turniername</Label>
            <Input id="settings-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-location">Ort (optional)</Label>
            <Input id="settings-location" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
          </div>
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
                  onChange={(e) => setEditDescription(e.target.value)}
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
        </SettingsCard>
      )}

      {canManage && !started && (
        <SettingsCard
          title="Zeitplan"
          description="Start, Anmeldung und Check-in. Nach dem Start steuern sie nichts mehr und sind hier nicht mehr zu sehen."
          dirty={scheduleDirty}
          saving={saving === "schedule"}
          invalid={!schedule.start_time || Object.keys(scheduleErrors).length > 0}
          onSave={() => save("schedule")}
        >
          <TournamentScheduleFields
            idPrefix="settings"
            values={schedule}
            errors={scheduleErrors}
            onChange={(patch) => setSchedule((prev) => ({ ...prev, ...patch }))}
          />
        </SettingsCard>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Tische</CardTitle>
          </CardHeader>
          <CardContent>
            <TableManager tournamentId={tournament.id} />
          </CardContent>
        </Card>
      )}

      {canManage && (
        <SettingsCard
          title="Link & Zugang"
          description={started ? "Die Adresse und wer die Ergebnisse sehen darf." : "Die Adresse, wer die Ergebnisse sieht und wer beitreten darf."}
          dirty={accessDirty}
          saving={saving === "access"}
          onSave={() => save("access")}
        >
          <div className="space-y-2">
            <Label htmlFor="settings-slug">Adresse</Label>
            <div className="flex items-center rounded-md border bg-background focus-within:ring-3 focus-within:ring-ring/50">
              <span className="pl-3 text-sm text-muted-foreground" aria-hidden="true">/t/</span>
              <Input
                id="settings-slug"
                value={editSlug}
                onChange={(e) => {
                  setEditSlug(e.target.value.toLowerCase());
                  setSlugError(null);
                }}
                className="border-0 pl-0.5 shadow-none focus-visible:ring-0"
                aria-invalid={!!slugError}
                aria-describedby="settings-slug-hint"
              />
            </div>
            {slugError && <p className="text-sm text-destructive">{slugError}</p>}
            <p id="settings-slug-hint" className="text-xs text-muted-foreground">
              {editSlug !== tournament.slug
                ? "Der alte Link und QR-Codes mit der alten Adresse funktionieren dann nicht mehr."
                : "So lautet der Link zum Turnier."}
            </p>
          </div>
          <AccessFields
            values={{ visibility: editVisibility, join_policy: editJoinPolicy }}
            joinable={!started}
            onChange={(patch) => {
              if (patch.visibility) setEditVisibility(patch.visibility);
              if (patch.join_policy) setEditJoinPolicy(patch.join_policy);
            }}
          />
          {/* who joins how: only while teams can still join */}
          {!started && tournament.join_policy === JoinPolicy.INVITE_ONLY && (
            <div className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-medium">Einladungslinks</h3>
              <p className="text-sm text-muted-foreground">
                Wer einen dieser Links öffnet, kann dem Turnier mit einem Team beitreten. Lege für jeden Kanal einen
                eigenen Link an und sieh, wie viele Teams darüber gekommen sind.
              </p>
              <InviteLinks tournamentId={tournament.id} />
            </div>
          )}
        </SettingsCard>
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
                    <Button variant="ghost" size="sm" onClick={() => handleRevokeRole(r)}>
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
            <Button variant="destructive" onClick={handleDeleteTournament}>
              <Trash2 className="mr-2 h-4 w-4" /> Turnier endgültig löschen
            </Button>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
