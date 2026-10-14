import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/format-when";
import { cn } from "@/lib/utils";
import type { Tournament } from "@/types";

interface SwitchRowProps {
  label: string;
  isOpen: boolean;
  /** What the schedule will do next, e.g. "schließt heute, 20:00 Uhr". */
  note?: string;
  onToggle: () => void;
}

function SwitchRow({ label, isOpen, note, onToggle }: Readonly<SwitchRowProps>) {
  return (
    <li className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-tight">{label}</p>
        <p className={cn("text-sm", isOpen ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>
          {isOpen ? "Offen" : "Geschlossen"}
          {note && <span className="text-muted-foreground"> · {note}</span>}
        </p>
      </div>
      <Button variant="outline" className="h-10 shrink-0" onClick={onToggle} aria-label={`${label} ${isOpen ? "schließen" : "öffnen"}`}>
        {isOpen ? "Schließen" : "Öffnen"}
      </Button>
    </li>
  );
}

/** Next automatic switch of registration / check-in, only while it is still ahead. */
export function registrationNote(t: Tournament, now = new Date()): string | undefined {
  if (!t.registration_open || !t.registration_auto_close || !t.registration_end_time) return undefined;
  return new Date(t.registration_end_time) > now ? `schließt ${formatWhen(t.registration_end_time, now)}` : undefined;
}

export function checkinNote(t: Tournament, now = new Date()): string | undefined {
  if (t.checkin_open || !t.checkin_auto_open || !t.checkin_start_time) return undefined;
  return new Date(t.checkin_start_time) > now ? `öffnet ${formatWhen(t.checkin_start_time, now)}` : undefined;
}

/**
 * Registration and check-in are independent switches: the organizer can open and close each of them at any
 * time (also both at once). A planned automatic switch is named next to the state.
 */
export function PreparationControls({
  tournament,
  onRegistration,
  onCheckin,
}: Readonly<{
  tournament: Tournament;
  onRegistration: (open: boolean) => void;
  onCheckin: (open: boolean) => void;
}>) {
  return (
    <ul className="divide-y rounded-lg border bg-card">
      <SwitchRow
        label="Anmeldung"
        isOpen={tournament.registration_open}
        note={registrationNote(tournament)}
        onToggle={() => onRegistration(!tournament.registration_open)}
      />
      {tournament.checkin_enabled && (
        <SwitchRow
          label="Check-in"
          isOpen={tournament.checkin_open}
          note={checkinNote(tournament)}
          onToggle={() => onCheckin(!tournament.checkin_open)}
        />
      )}
    </ul>
  );
}
