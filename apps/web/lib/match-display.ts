import type { MatchSlot } from "@/lib/bracket-layout";
import { cn } from "@/lib/utils";
import type { Match, Team } from "@/types";

/**
 * How a match is shown, shared by the bracket card, the match list and "my matches", so they never disagree.
 * The first team of a match plays red, the second blue.
 */
export type Side = "a" | "b";

export const SIDE_STYLE = {
  a: { label: "rot", stripe: "border-l-red-500", stripeMuted: "border-l-red-500/30", winnerBg: "bg-red-500/10" },
  b: { label: "blau", stripe: "border-l-blue-500", stripeMuted: "border-l-blue-500/30", winnerBg: "bg-blue-500/10" },
} as const;

export interface SideInfo {
  side: Side;
  id: string | null;
  /** null while the team is not known yet */
  name: string | null;
  /** Where the team comes from while it is not known yet ("Sieger Spiel 3"). */
  placeholder: string;
  isWinner: boolean;
  isChampion: boolean;
  /** Played and lost: shown as disabled. */
  isLoser: boolean;
}

const teamName = (teamsMap: Record<string, Team>, id: string | null) =>
  id === null ? null : teamsMap[id]?.name || "Unbekannt";

const placeholderFor = (source: number | null) => (source === null ? "Offen" : `Sieger Spiel ${source}`);

export function describeSides(
  slot: MatchSlot,
  teamsMap: Record<string, Team>,
  championTeamId?: string | null,
): [SideInfo, SideInfo] {
  const { match, sources } = slot;
  const finished = match.status === "finished";
  const build = (side: Side, id: string | null, source: number | null): SideInfo => {
    const isWinner = finished && id !== null && id === match.winner_team_id;
    return {
      side,
      id,
      name: teamName(teamsMap, id),
      placeholder: placeholderFor(source),
      isWinner,
      isChampion: id !== null && id === championTeamId,
      isLoser: finished && id !== null && !isWinner,
    };
  };
  return [build("a", match.team_a_id, sources.a), build("b", match.team_b_id, sources.b)];
}

/** Both teams are known and there is no result yet: queued, at its table or live. */
export function isOpen(match: Match): boolean {
  return match.status === "queued" || match.status === "ready" || match.status === "live";
}

/**
 * The status as short as it stays clear next to its icon: "Wartet" (for a team, the rows name the matches it comes
 * from), "Platz 2" (in the queue for a table), "Bereit", "Live", or the cups the winner had left.
 */
export function statusLabel(match: Match): string {
  switch (match.status) {
    case "waiting":
      return "Wartet";
    case "queued":
      return match.queue_position != null ? `Platz ${match.queue_position}` : "Wartet";
    case "ready":
      return "Bereit";
    case "live":
      return "Live";
    default:
      return match.cups_left != null ? `${match.cups_left} Becher` : "Beendet";
  }
}

/** The status in words, for screen readers and as tooltip of the badge; null for a finished match. */
export function statusText(match: Match): string | null {
  switch (match.status) {
    case "waiting":
      return "Wartet auf Team";
    case "queued":
      return match.queue_position != null
        ? `Wartet auf Tisch, Platz ${match.queue_position} in der Warteschlange`
        : "Wartet auf Tisch";
    case "ready":
      return "Bereit";
    case "live":
      return "Läuft";
    default:
      return null;
  }
}

/** Badge colors by status: grey waits for a team, amber for a table, green can start, red is live. */
export const STATUS_STYLE: Record<Exclude<Match["status"], "finished">, string> = {
  waiting: "bg-muted text-muted-foreground",
  queued: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  ready: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  live: "bg-red-600 text-white", // white on red-600 keeps 4.5:1 in both themes
};

/**
 * The table to go to, only while it matters: at the table (ready), playing there (live), or still waiting for a
 * team when the API says the table is already certain. Never a guess.
 */
export function tableOf(match: Match): string | null {
  if (match.status === "ready" || match.status === "live") return match.table_name;
  return match.status === "waiting" ? match.upcoming_table_name : null;
}

/**
 * Classes of a team on a card or row: the colored stripe stays strong until the match is decided and then
 * only the winner keeps it (with a tint); the loser is disabled. The own team gets the highlight color.
 */
export function sideTone(side: SideInfo, isMine: boolean, tinted = true): string {
  const colors = SIDE_STYLE[side.side];
  return cn(
    "border-l-4",
    side.isLoser || side.name === null ? colors.stripeMuted : colors.stripe,
    isMine ? "bg-primary/10" : tinted && side.isWinner && colors.winnerBg,
    side.isLoser && "text-muted-foreground",
  );
}

/** One sentence for screen readers: number, teams with their colors, state and what it waits for, winner, cups. */
export function matchSummary(slot: MatchSlot, sides: [SideInfo, SideInfo], teamsMap: Record<string, Team>): string {
  const { match, number } = slot;
  const finished = match.status === "finished";
  return [
    `Spiel ${number}`,
    sides.map((s) => `${s.name ?? s.placeholder} (${SIDE_STYLE[s.side].label})`).join(" gegen "),
    statusText(match),
    tableOf(match),
    finished ? `beendet, Sieger ${teamName(teamsMap, match.winner_team_id) ?? "unbekannt"}` : null,
    finished && match.cups_left != null ? `${match.cups_left} Becher übrig` : null,
  ]
    .filter(Boolean)
    .join(", ");
}
