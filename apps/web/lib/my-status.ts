import type { MatchSlot } from "@/lib/bracket-layout";
import { formatWhen } from "@/lib/format-when";
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

/** Where the opponent of a match still comes from: the feeder match, with its teams and how far it is. */
function opponentSource(slot: MatchSlot, slots: MatchSlot[], teamId: string, teamsMap: Record<string, Team>): string {
  const missing = slot.match.team_a_id === teamId ? "b" : "a";
  const number = slot.sources[missing];
  const feeder = slots.find((s) => s.number === number);
  if (!feeder) return "Dein Gegner steht noch nicht fest.";
  const { match } = feeder;
  if (!match.team_a_id || !match.team_b_id) return `Dein Gegner ist der Sieger aus Spiel ${feeder.number}.`;
  const pair = `${name(teamsMap, match.team_a_id)} oder ${name(teamsMap, match.team_b_id)}`;
  const progress: Partial<Record<Match["status"], string>> = {
    live: match.table_name ? ` – läuft an ${match.table_name}` : " – läuft",
    ready: match.table_name ? ` – gleich an ${match.table_name}` : "",
    // no place in the queue here: it belongs to the other match and would read as my own
    queued: " – wartet auf einen Tisch",
  };
  return `Dein Gegner: ${pair} (Spiel ${feeder.number}${progress[match.status] ?? ""}).`;
}

/** While it runs and after: the next match of the team, or how it ended. */
export function statusInBracket(
  slots: MatchSlot[],
  totalRounds: number,
  team: TournamentTeam,
  teamsMap: Record<string, Team>,
  championTeamId: string | null,
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
        detail: opponentSource(next, slots, team.id, teamsMap),
        slot: next,
      };
  }
}
