import type { Tournament, TournamentPhase, TournamentTeam } from "@/types";

const PHASE_LABELS: Record<TournamentPhase, string> = {
  registration: "Anmeldung offen",
  registration_and_checkin: "Anmeldung & Check-in offen",
  registration_closed: "Anmeldung geschlossen",
  checkin: "Check-in läuft",
  running: "Läuft",
  finished: "Beendet",
};

/** Short status text for the badge. The API decides the phase, the UI only names it. */
export function phaseLabel(phase: TournamentPhase): string {
  return PHASE_LABELS[phase];
}

export interface StartPlan {
  playing: TournamentTeam[];
  removed: TournamentTeam[];
  canStart: boolean;
  /** Consequences of starting now, shown before the organizer confirms. */
  description: string;
}

const teamWord = (n: number) => (n === 1 ? "Team" : "Teams");

/** Mirrors the API: with check-in only checked-in teams play, without it everybody plays. */
export function planStart(
  tournament: Pick<Tournament, "checkin_enabled">,
  teams: TournamentTeam[],
): StartPlan {
  const playing = tournament.checkin_enabled ? teams.filter((t) => t.is_checked_in) : teams;
  const removed = teams.filter((t) => !playing.includes(t));
  const canStart = playing.length >= 2;

  let description: string;
  if (!canStart) {
    description = tournament.checkin_enabled
      ? "Mindestens 2 Teams müssen eingecheckt sein, um das Turnier zu starten."
      : "Mindestens 2 Teams müssen angemeldet sein, um das Turnier zu starten.";
  } else {
    const parts = [`${playing.length} ${teamWord(playing.length)} spielen mit. Der Turnierbaum wird jetzt ausgelost.`];
    if (removed.length > 0) {
      parts.push(
        `Nicht eingecheckt und deshalb aus dem Turnier entfernt: ${removed.map((t) => t.name).join(", ")}.`,
      );
    }
    parts.push("Danach sind keine Anmeldungen mehr möglich. Das kann nicht rückgängig gemacht werden.");
    description = parts.join(" ");
  }
  return { playing, removed, canStart, description };
}
