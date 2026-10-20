import type { MatchSlot } from "@/lib/bracket-layout";
import { formatWhen } from "@/lib/format-when";
import { minutesSince } from "@/lib/minutes";
import type { Match, Team, Tournament, TournamentTeam, Bracket } from "@/types";
import type { StationTerms } from "@/components/games";
import { freeOne } from "@/lib/station-terms";

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

/** A status in two or three words for the list of my tournaments: only when there is something to know. */
export interface ShortStatus {
  tone: StatusTone;
  icon: StatusIcon;
  text: string;
}

/**
 * The short form of the status card for the list of my tournaments, from what the list API brings along (no
 * bracket): check in now, go to your station, you are next, a break, the place at the end. Nothing when all is fine
 * and nothing is to do (registered, check-in not open yet): the team badge says that already.
 */
export function listStatus(
  tournament: Tournament,
  participation: { is_checked_in: boolean; next_match: Match | null; place: number | null },
  terms: StationTerms,
): ShortStatus | null {
  const { is_checked_in, next_match: match, place } = participation;
  if (place === 1) return { tone: "done", icon: "trophy", text: "Gewonnen" };
  if (place !== null) return { tone: "done", icon: "award", text: `Platz ${place}` };
  if (!tournament.started_at) {
    if (!tournament.checkin_enabled) return null;
    if (is_checked_in) return { tone: "done", icon: "check", text: "Eingecheckt" };
    return tournament.checkin_open ? { tone: "urgent", icon: "alert", text: "Jetzt einchecken" } : null;
  }
  switch (match?.status) {
    case "ready":
      return { tone: "urgent", icon: "go", text: `Jetzt zu ${match.station_name ?? terms.yours}` };
    case "live":
      return { tone: "active", icon: "play", text: `Spielt an ${match.station_name ?? terms.dative}` };
    case "queued":
      return match.queue_position === 1
        ? { tone: "attention", icon: "queue", text: "Als Nächstes dran" }
        : { tone: "relaxed", icon: "queue", text: `Warteschlange #${match.queue_position ?? "–"}` };
    case "waiting":
      return { tone: "relaxed", icon: "pause", text: "Pause" };
    default:
      return null;
  }
}

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
 * where to watch. The station of the own match only when the API says it is certain; no place in the queue of the
 * other match (it would read as the own one).
 */
function opponentSource(
  slot: MatchSlot,
  slots: MatchSlot[],
  teamId: string,
  teamsMap: Record<string, Team>,
  terms: StationTerms,
  now: Date,
): string {
  const missing = slot.match.team_a_id === teamId ? "b" : "a";
  const feeder = slots.find((s) => s.number === slot.sources[missing])?.match;
  if (!feeder?.team_a_id || !feeder.team_b_id) return "Dein Gegner steht noch nicht fest.";
  const [a, b] = [name(teamsMap, feeder.team_a_id), name(teamsMap, feeder.team_b_id)];
  const upcoming = slot.match.upcoming_station_name;
  const atStation = feeder.status === "live" || feeder.status === "ready" ? feeder.station_name : null;
  if (upcoming && upcoming === atStation) {
    // the usual case at the end: the winner stays, so the next match is where the opponent plays now
    const there = feeder.status === "live" ? `spielen gerade ${a} und ${b}${runningFor(feeder.started_at, now)}` : `spielen gleich ${a} und ${b}`;
    return `Euer Spiel ist danach an ${upcoming}. Dort ${there}.`;
  }
  const progress: Partial<Record<Match["status"], string>> = {
    live: `spielen an ${feeder.station_name}${runningFor(feeder.started_at, now)}`,
    ready: `gleich an ${feeder.station_name}`,
    queued: `warten noch auf ${terms.accusative}`,
  };
  const opponent = `Dein Gegner: ${a} oder ${b} – ${progress[feeder.status] ?? "noch offen"}.`;
  return upcoming ? `Euer Spiel ist danach an ${upcoming}. ${opponent}` : opponent;
}

/** Where everybody plays everybody and my matches are played: my place in the table (final once all is played). */
function tableStatus(bracket: BracketState, team: TournamentTeam): MyStatus | null {
  const row = bracket.standings?.find((r) => r.team_id === team.id);
  if (!row) return null;
  if (bracket.champion_team_id) {
    return { tone: "done", icon: "award", title: `Das Turnier ist vorbei: Platz ${row.rank} mit ${team.name}.` };
  }
  return {
    tone: "relaxed",
    icon: "pause",
    title: `Alle deine Spiele sind gespielt: Platz ${row.rank} mit ${team.name}.`,
    detail: "Die anderen spielen noch, die Tabelle kann sich noch ändern.",
  };
}

type BracketState = Pick<Bracket, "total_rounds" | "champion_team_id" | "standings">;

/** While it runs and after: the next match of the team, or how it ended. */
export function statusInBracket(
  slots: MatchSlot[],
  bracket: BracketState,
  team: TournamentTeam,
  teamsMap: Record<string, Team>,
  terms: StationTerms,
  now: Date = new Date(),
): MyStatus | null {
  const mine = slots.filter((s) => s.match.team_a_id === team.id || s.match.team_b_id === team.id);
  if (bracket.champion_team_id === team.id) {
    return { tone: "done", icon: "trophy", title: `Du hast das Turnier gewonnen – Platz 1 mit ${team.name}!` };
  }
  // a knock-out ends with the first defeat; where everybody plays everybody a defeat costs points only
  const lost = !bracket.standings && mine.find((s) => s.match.status === "finished" && s.match.winner_team_id !== team.id);
  if (lost) {
    const place = knockoutPlace(lost.match.round, bracket.total_rounds);
    return { tone: "done", icon: "award", title: `Du bist ausgeschieden: Platz ${place} mit ${team.name}.` };
  }
  const next = mine.find((s) => s.match.status !== "finished");
  if (!next) return tableStatus(bracket, team);
  const { match } = next;
  const opponentId = match.team_a_id === team.id ? match.team_b_id : match.team_a_id;
  const opponent = name(teamsMap, opponentId);
  const station = match.station_name ?? terms.yours;
  switch (match.status) {
    case "ready":
      return { tone: "urgent", icon: "go", title: `Geh jetzt zu ${station}: Spiel gegen ${opponent}.`, slot: next };
    case "live":
      return { tone: "active", icon: "play", title: `Du spielst an ${station} gegen ${opponent}.`, slot: next };
    case "queued":
      return match.queue_position === 1
        ? {
            tone: "attention",
            icon: "queue",
            title: `Halte dich bereit: Als Nächstes spielst du gegen ${opponent}.`,
            detail: `Sobald ${terms.nominative} frei wird, steht hier, wohin du gehst.`,
            slot: next,
          }
        : {
            tone: "relaxed",
            icon: "queue",
            title: `Warte auf ${freeOne(terms)} für dein Spiel gegen ${opponent}.`,
            detail: match.queue_position != null ? `Nr. ${match.queue_position} in der Warteschlange.` : null,
            slot: next,
          };
    default:
      return {
        tone: "relaxed",
        icon: "pause",
        title: "Pause: Du wartest auf deinen Gegner.",
        detail: opponentSource(next, slots, team.id, teamsMap, terms, now),
        slot: next,
      };
  }
}
