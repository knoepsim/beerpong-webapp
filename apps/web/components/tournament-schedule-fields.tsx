"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ScheduleErrors, ScheduleValues } from "@/lib/tournament-schedule";

/**
 * Start, registration deadline and optional check-in of a tournament.
 * Shared by the create dialog and the settings so both explain the options the same way.
 */
export function TournamentScheduleFields({
  values,
  errors,
  onChange,
  disabled = false,
  checkinLocked = false,
  idPrefix = "schedule",
}: {
  values: ScheduleValues;
  errors: ScheduleErrors;
  onChange: (patch: Partial<ScheduleValues>) => void;
  disabled?: boolean;
  /** Check-in can no longer be switched once the tournament has started. */
  checkinLocked?: boolean;
  idPrefix?: string;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={id("start")}>Startzeit *</Label>
        <Input
          id={id("start")}
          type="datetime-local"
          value={values.start_time}
          onChange={(e) => onChange({ start_time: e.target.value })}
          disabled={disabled}
          aria-invalid={!!errors.start_time}
        />
        {errors.start_time && <p className="text-sm text-destructive">{errors.start_time}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("registration-end")}>Anmeldeschluss</Label>
        <Input
          id={id("registration-end")}
          type="datetime-local"
          value={values.registration_end_time}
          onChange={(e) => onChange({ registration_end_time: e.target.value })}
          disabled={disabled}
          aria-invalid={!!errors.registration_end_time}
          aria-describedby={id("registration-end-hint")}
        />
        {errors.registration_end_time ? (
          <p className="text-sm text-destructive">{errors.registration_end_time}</p>
        ) : (
          <p id={id("registration-end-hint")} className="text-xs text-muted-foreground">
            Danach können sich keine Teams mehr anmelden. Leer lassen: Anmeldung bis zum Start.
          </p>
        )}
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor={id("checkin")} className="text-sm font-medium">
              Check-in vor Ort
            </Label>
            <p className="text-xs text-muted-foreground">
              {values.checkin_enabled
                ? "Teams melden sich vor Ort beim Orga-Team. Wer beim Start nicht eingecheckt ist, wird aus dem Turnier entfernt."
                : "Aus: Beim Start spielen alle angemeldeten Teams."}
            </p>
          </div>
          <Switch
            id={id("checkin")}
            checked={values.checkin_enabled}
            onCheckedChange={(checked) =>
              onChange({ checkin_enabled: checked, ...(checked ? {} : { checkin_start_time: "" }) })
            }
            disabled={disabled || checkinLocked}
          />
        </div>

        {values.checkin_enabled && (
          <div className="space-y-1.5">
            <Label htmlFor={id("checkin-start")}>Check-in ab</Label>
            <Input
              id={id("checkin-start")}
              type="datetime-local"
              value={values.checkin_start_time}
              onChange={(e) => onChange({ checkin_start_time: e.target.value })}
              disabled={disabled || checkinLocked}
              aria-invalid={!!errors.checkin_start_time}
              aria-describedby={id("checkin-start-hint")}
            />
            {errors.checkin_start_time ? (
              <p className="text-sm text-destructive">{errors.checkin_start_time}</p>
            ) : (
              <p id={id("checkin-start-hint")} className="text-xs text-muted-foreground">
                Zur Orientierung für die Spieler. Leer lassen: Der Check-in beginnt mit dem Anmeldeschluss (ohne Anmeldeschluss sofort). Du kannst ihn im Turnier jederzeit früher starten.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
