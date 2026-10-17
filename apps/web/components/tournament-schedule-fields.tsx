"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ScheduleErrors, ScheduleValues } from "@/lib/tournament-schedule";

/** A switch behind a date: it can only be used with a date, and says why otherwise. */
function AutomationSwitch({
  id,
  label,
  checked,
  hasTime,
  disabled,
  onCheckedChange,
}: Readonly<{
  id: string;
  label: string;
  checked: boolean;
  hasTime: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}>) {
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <Label htmlFor={id} className="text-sm font-normal leading-snug">
        {hasTime ? label : `${label} (erst mit Datum möglich)`}
      </Label>
      <Switch id={id} checked={checked && hasTime} onCheckedChange={onCheckedChange} disabled={disabled || !hasTime} />
    </div>
  );
}

/**
 * Start, registration deadline and optional check-in of a tournament. The times are a guide for the players;
 * the switch behind a time lets the app act at that time (close the registration, open check-in). Opening and
 * closing by hand is always possible in the tournament itself.
 * Shared by the create dialog and the settings so both explain the options the same way.
 */
export function TournamentScheduleFields({
  values,
  errors,
  onChange,
  disabled = false,
  idPrefix = "schedule",
}: {
  values: ScheduleValues;
  errors: ScheduleErrors;
  onChange: (patch: Partial<ScheduleValues>) => void;
  disabled?: boolean;
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
          onChange={(e) =>
            // a new deadline is meant to close the registration; clearing it takes the automation away
            onChange({
              registration_end_time: e.target.value,
              registration_auto_close: e.target.value ? values.registration_auto_close || !values.registration_end_time : false,
            })
          }
          disabled={disabled}
          aria-invalid={!!errors.registration_end_time}
          aria-describedby={id("registration-end-hint")}
        />
        {errors.registration_end_time && <p className="text-sm text-destructive">{errors.registration_end_time}</p>}
        <p id={id("registration-end-hint")} className="text-xs text-muted-foreground">
          Zur Orientierung für die Spieler. Leer lassen: keine Frist.
        </p>
        <AutomationSwitch
          id={id("registration-auto")}
          label="Anmeldung zu dieser Zeit automatisch schließen"
          checked={values.registration_auto_close}
          hasTime={!!values.registration_end_time}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ registration_auto_close: checked })}
        />
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
              onChange({ checkin_enabled: checked, ...(checked ? {} : { checkin_start_time: "", checkin_auto_open: false }) })
            }
            disabled={disabled}
          />
        </div>

        {values.checkin_enabled && (
          <div className="space-y-1.5">
            <Label htmlFor={id("checkin-start")}>Check-in ab</Label>
            <Input
              id={id("checkin-start")}
              type="datetime-local"
              value={values.checkin_start_time}
              onChange={(e) =>
                onChange({
                  checkin_start_time: e.target.value,
                  checkin_auto_open: e.target.value ? values.checkin_auto_open || !values.checkin_start_time : false,
                })
              }
              disabled={disabled}
              aria-invalid={!!errors.checkin_start_time}
              aria-describedby={id("checkin-start-hint")}
            />
            {errors.checkin_start_time && <p className="text-sm text-destructive">{errors.checkin_start_time}</p>}
            <p id={id("checkin-start-hint")} className="text-xs text-muted-foreground">
              Zur Orientierung für die Spieler. Leer lassen: keine Zeit.
            </p>
            <AutomationSwitch
              id={id("checkin-auto")}
              label="Check-in zu dieser Zeit automatisch öffnen"
              checked={values.checkin_auto_open}
              hasTime={!!values.checkin_start_time}
              disabled={disabled}
              onCheckedChange={(checked) => onChange({ checkin_auto_open: checked })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
