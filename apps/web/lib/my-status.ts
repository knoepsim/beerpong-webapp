import type { MatchSlot } from "@/lib/bracket-layout";
import { formatWhen } from "@/lib/format-when";
import { minutesSince } from "@/lib/minutes";
import type { Match, Team, Tournament, TournamentTeam } from "@/types";

/**
 * What the participant has to do, as a color: go now (urgent), get ready (attention), playing (active),
 * nothing to do for a while (relaxed), done or all set (done).
 */
export type StatusTone = "urgent" | "attention" | "active" | "relaxed" | "done";

export type StatusIcon =
  | "go"
  | "play"
  | "queue"
  | "pause"
  | "award"
  | "trophy"
  | "check"
  | "alert"
  | "calendar"
  | "join";

export interface MyStatus {
  tone: StatusTone;
  icon: StatusIcon;
  /** One sentence that says what is going on, no heading needed. */
  title: string;
  detail?: string | null;
  /** The match it is about, shown below the sentence. */
  slot?: MatchSlot | null;
}

const name = (teamsMap: Record<string, Team>, id: string | null) =>
  (id && teamsMap[id]?.name) || "Unbekannt";

/** Place of a team that lost in `round` of a knock-out with `totalRounds` rounds: final 2, semi-final 3, ... */
export function knockoutPlace(round: number, totalRounds: number): number {
  return 2 ** (totalRounds - round) + 1;
}

/** Before the start: registered, checked in or not, when it goes on. */
export function statusBeforeStart(tournament: Tournament, team: TournamentTeam, now = new Date()): MyStatus {
  const start = tournament.start_time ? `Das Turnier beginnt ${formatWhen(tournament.start_time, now)}.` : null;
  if (tournament.checkin_enabled && team.is_checked_in) {
    return { tone: "done", icon: "check", title: `${team.name} ist eingecheckt.`, detail: start };
  }
  if (tournament.checkin_enabled && tournament.checkin_open) {
    return {
      tone: "urgent",
      icon: "alert",
      title: "Check jetzt vor Ort beim Orga-Team ein.",
      detail: `Ohne Check-in wird ${team.name} beim Turnierstart entfernt.`,
    };
  }
  if (tournament.checkin_enabled) {
    return {
      tone: "relaxed",
      icon: "calendar",
      title: `${team.name} ist angemeldet.`,
      detail:
        tournament.checkin_auto_open && tournament.checkin_start_time
          ? `Der Check-in beginnt ${formatWhen(tournament.checkin_start_time, now)}.`
          : "Den Check-in öffnet das Orga-Team vor Ort.",
    };
  }
  return { tone: "done", icon: "check", title: `${team.name} ist angemeldet.`, detail: start };
}

/** ", seit 8 Minuten" for a running match (real data, no forecast: everybody knows how long a match takes). */
function runningFor(startedAt: string | null, now: Date): string {
  if (!startedAt) return "";
  const minutes = minutesSince(startedAt, now);
  if (minutes < 1) return ", gerade gestartet";
  return minutes === 1 ? ", seit 1 Minute" : `, seit ${minutes} Minuten`;
}

/**
 * Who the opponent can be and how far that match is, so a waiting team can judge how long its break lasts and
 * where to watch. The table of the own match only when the API says it is certain; no place in the queue of the
 * other match (it would read as the own one).
 */
function opponentSource(
  slot: MatchSlot,
  slots: MatchSlot[],
  teamId: string,
  teamsMap: Record<string, Team>,
  now: Date,
): string {
  const missing = slot.match.team_a_id === teamId ? "b" : "a";
  const feeder = slots.find((s) => s.number === slot.sources[missing])?.match;
  if (!feeder?.team_a_id || !feeder.team_b_id) return "Dein Gegner steht noch nicht fest.";
  const [a, b] = [name(teamsMap, feeder.team_a_id), name(teamsMap, feeder.team_b_id)];
  const upcoming = slot.match.upcoming_table_name;
  const atTable = feeder.status === "live" || feeder.status === "ready" ? feeder.table_name : null;
  if (upcoming && upcoming === atTable) {
    // the usual case at the end: the winner stays, so the next match is where the opponent plays now
    const there = feeder.status === "live" ? `spielen gerade ${a} und ${b}${runningFor(feeder.started_at, now)}` : `spielen gleich ${a} und ${b}`;
    return `Euer Spiel ist danach an ${upcoming}. Dort ${there}.`;
  }
  const progress: Partial<Record<Match["status"], string>> = {
    live: `spielen an ${feeder.table_name}${runningFor(feeder.started_at, now)}`,
    ready: `gleich an ${feeder.table_name}`,
    queued: "warten noch auf einen Tisch",
  };
  const opponent = `Dein Gegner: ${a} oder ${b} – ${progress[feeder.status] ?? "noch offen"}.`;
  return upcoming ? `Euer Spiel ist danach an ${upcoming}. ${opponent}` : opponent;
}

/** While it runs and after: the next match of the team, or how it ended. */
export function statusInBracket(
  slots: MatchSlot[],
  totalRounds: number,
  team: TournamentTeam,
  teamsMap: Record<string, Team>,
  championTeamId: string | null,
  now: Date = new Date(),
): MyStatus | null {
  const mine = slots.filter((s) => s.match.team_a_id === team.id || s.match.team_b_id === team.id);
  if (championTeamId === team.id) {
    return { tone: "done", icon: "trophy", title: `Du hast das Turnier gewonnen – Platz 1 mit ${team.name}!` };
  }
  const lost = mine.find((s) => s.match.status === "finished" && s.match.winner_team_id !== team.id);
  if (lost) {
    const place = knockoutPlace(lost.match.round, totalRounds);
    return { tone: "done", icon: "award", title: `Du bist ausgeschieden: Platz ${place} mit ${team.name}.` };
  }
  const next = mine.find((s) => s.match.status !== "finished");
  if (!next) return null;
  const { match } = next;
  const opponentId = match.team_a_id === team.id ? match.team_b_id : match.team_a_id;
  const opponent = name(teamsMap, opponentId);
  const table = match.table_name ?? "deinem Tisch";
  switch (match.status) {
    case "ready":
      return { tone: "urgent", icon: "go", title: `Geh jetzt zu ${table}: Spiel gegen ${opponent}.`, slot: next };
    case "live":
      return { tone: "active", icon: "play", title: `Du spielst an ${table} gegen ${opponent}.`, slot: next };
    case "queued":
      return match.queue_position === 1
        ? {
            tone: "attention",
            icon: "queue",
            title: `Halte dich bereit: Als Nächstes spielst du gegen ${opponent}.`,
            detail: "Sobald ein Tisch frei wird, steht hier, wohin du gehst.",
            slot: next,
          }
        : {
            tone: "relaxed",
            icon: "queue",
            title: `Warte auf einen freien Tisch für dein Spiel gegen ${opponent}.`,
            detail: match.queue_position != null ? `Platz ${match.queue_position} in der Warteschlange.` : null,
            slot: next,
          };
    default:
      return {
        tone: "relaxed",
        icon: "pause",
        title: "Pause: Du wartest auf deinen Gegner.",
        detail: opponentSource(next, slots, team.id, teamsMap, now),
        slot: next,
      };
  }
}
