"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isSlugError, useDeleteTournament, useUpdateTournament } from "@/hooks/queries/tournaments";
import { errorMessage } from "@/lib/errors";
import type { Tournament, TournamentCreateRequest, TournamentUserRole } from "@/types";
import { AccessFields } from "@/components/access-fields";
import { useConfirm } from "@/components/confirm-dialog";
import { RoleManager } from "@/components/role-manager";
import { MarkdownEditor } from "@/components/markdown-editor";
import { GamePicker } from "@/components/game-picker";
import { GAMES } from "@/components/games";
import { ModePicker } from "@/components/mode-picker";
import { StationManager } from "@/components/station-manager";
import { TournamentScheduleFields } from "@/components/tournament-schedule-fields";
import { scheduleToPayload, toIsoOrNull, toLocalInput, validateSchedule, type ScheduleValues } from "@/lib/tournament-schedule";
import { Game, TournamentMode, TournamentRoleType } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Trash2, ShieldAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";

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
  let label = dirty ? `${title} speichern` : "Gespeichert";
  if (saving) label = "Wird gespeichert…";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <Button onClick={onSave} disabled={saving || invalid || !dirty}>
          {label}
        </Button>
      </CardContent>
    </Card>
  );
}

type Group = "general" | "play" | "schedule" | "access";

export function TournamentSettings({
  tournament,
  roles,
  userRole,
}: Readonly<{
  tournament: Tournament;
  roles: TournamentUserRole[];
  userRole: TournamentRoleType | null;
}>) {
  const router = useRouter();
  const confirm = useConfirm();
  const update = useUpdateTournament(tournament.id);
  const deleteTournament = useDeleteTournament(tournament.id);
  // Edit details form state
  const [editName, setEditName] = useState(tournament.name);
  const [editLocation, setEditLocation] = useState(tournament.location || "");
  const [editDescription, setEditDescription] = useState(tournament.description || "");
  const [editVisibility, setEditVisibility] = useState(tournament.visibility);
  const [editJoinPolicy, setEditJoinPolicy] = useState(tournament.join_policy);
  const [editSlug, setEditSlug] = useState(tournament.slug);
  const [editGame, setEditGame] = useState(tournament.game);
  const [editMode, setEditMode] = useState<TournamentMode | undefined>(tournament.mode);
  // another game may not have the mode: then it is chosen again
  const changeGame = (game: Game) => {
    setEditGame(game);
    if (editMode && !GAMES[game].modes.includes(editMode)) setEditMode(undefined);
  };
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
  const [saving, setSaving] = useState<Group | null>(null);
  const slugError = update.error && isSlugError(update.error) ? errorMessage(update.error) : null;

  // the schedule and who may join only matter before the start: afterwards they are not shown (the API keeps them too)
  const started = !!tournament.started_at;
  const generalDirty =
    editName !== tournament.name ||
    editLocation !== (tournament.location || "") ||
    editDescription !== (tournament.description || "");
  const scheduleDirty = (Object.keys(initialSchedule) as (keyof ScheduleValues)[]).some(
    (k) => schedule[k] !== initialSchedule[k],
  );
  const playDirty = editGame !== tournament.game || editMode !== tournament.mode;
  const accessDirty =
    editVisibility !== tournament.visibility || editJoinPolicy !== tournament.join_policy || editSlug !== tournament.slug;

  /** Each card saves only its own fields. */
  const save = (group: Group) => {
    const payloads: Record<Group, Partial<TournamentCreateRequest>> = {
      general: { name: editName, location: editLocation || undefined, description: editDescription || undefined },
      play: { game: editGame, mode: editMode },
      schedule: { start_time: toIsoOrNull(schedule.start_time) ?? undefined, ...scheduleToPayload(schedule) },
      access: { slug: editSlug, visibility: editVisibility, ...(started ? {} : { join_policy: editJoinPolicy }) },
    };
    setSaving(group);
    update.mutate(payloads[group], {
      // a changed address is the new page of the tournament
      onSuccess: (saved) => {
        if (saved.slug !== tournament.slug) router.replace(`/t/${saved.slug}`);
      },
      onSettled: () => setSaving(null),
    });
  };

  // the same search again asks the server again (somebody may have registered in the meantime)
  const handleDeleteTournament = () => {
    void confirm({
      title: `${tournament.name} löschen?`,
      description: "Das Turnier mit allen Anmeldungen, Spielen und Ergebnissen ist danach für alle weg. Das lässt sich nicht rückgängig machen.",
      confirmLabel: "Turnier löschen",
      destructive: true,
      typeToConfirm: "LÖSCHEN",
      action: async () => {
        await deleteTournament.mutateAsync();
        router.push("/tournaments");
      },
    });
  };

  const canManage = userRole === TournamentRoleType.ADMIN || userRole === TournamentRoleType.MANAGER;

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
            <Label>Beschreibung</Label>
            <MarkdownEditor
              value={editDescription}
              onChange={setEditDescription}
              aria-label="Beschreibung"
              placeholder="Turnier-Regeln, Zeitplan, Preise…"
            />
          </div>
        </SettingsCard>
      )}

      {canManage && !started && (
        <SettingsCard
          title="Spiel & Modus"
          description="Was und wie gespielt wird. Mit dem Start steht es fest und ist hier nicht mehr zu sehen."
          dirty={playDirty}
          invalid={!editMode}
          saving={saving === "play"}
          onSave={() => save("play")}
        >
          <div className="space-y-2">
            <Label htmlFor="settings-game">Spiel</Label>
            <GamePicker id="settings-game" value={editGame} onChange={(game) => game && changeGame(game)} />
          </div>
          <ModePicker name="settings-mode" modes={GAMES[editGame].modes} value={editMode} onChange={setEditMode} />
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
            <CardTitle>{GAMES[tournament.game].station.plural}</CardTitle>
          </CardHeader>
          <CardContent>
            <StationManager tournamentId={tournament.id} />
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
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>/t/</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="settings-slug"
                value={editSlug}
                onChange={(e) => {
                  setEditSlug(e.target.value.toLowerCase());
                  update.reset();
                }}
                aria-invalid={!!slugError}
                aria-describedby="settings-slug-hint"
              />
            </InputGroup>
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
        </SettingsCard>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rollen</CardTitle>
          <CardDescription>Wer das Turnier mitverwaltet oder Ergebnisse einträgt.</CardDescription>
        </CardHeader>
        <CardContent>
          <RoleManager tournamentId={tournament.id} roles={roles} userRole={userRole} />
        </CardContent>
      </Card>

      {userRole === TournamentRoleType.ADMIN && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="size-5" aria-hidden="true" />
              Gefahrenzone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleDeleteTournament}>
              <Trash2 aria-hidden="true" /> Turnier endgültig löschen
            </Button>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
