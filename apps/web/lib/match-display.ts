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

/** The status in a few words: "Wartet auf Team", "Wartet auf Tisch", "Bereit", "Live" or the cups of the winner. */
export function statusLabel(match: Match): string {
  switch (match.status) {
    case "waiting":
      return "Wartet auf Team";
    case "queued":
      return "Wartet auf Tisch";
    case "ready":
      return "Bereit";
    case "live":
      return "Live";
    default:
      return match.cups_left != null ? `${match.cups_left} Becher` : "Beendet";
  }
}

/** Badge colors by status: grey waits for a team, amber for a table, green can start, red is live. */
export const STATUS_STYLE: Record<Exclude<Match["status"], "finished">, string> = {
  waiting: "bg-muted text-muted-foreground",
  queued: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  ready: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  live: "bg-red-600 text-white", // white on red-600 keeps 4.5:1 in both themes
};

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * The second line of a match, only what the status does not say: whom it waits for (by color, the team is not
 * known yet), its place in the queue, or the table to go to. Nothing for a finished match.
 */
export function statusDetail(slot: MatchSlot): string | null {
  const { match, sources } = slot;
  switch (match.status) {
    case "waiting": {
      const missing = (["a", "b"] as const).filter((side) => (side === "a" ? match.team_a_id : match.team_b_id) === null);
      const where = (side: Side) => (sources[side] === null ? "offen" : `noch in Spiel ${sources[side]}`);
      // both: the rows below already name the matches they come from
      if (missing.length === 2) return "Beide Teams offen";
      return `${capitalize(SIDE_STYLE[missing[0]].label)} ${where(missing[0])}`;
    }
    case "queued":
      return match.queue_position != null ? `Warteschlange #${match.queue_position}` : null;
    case "ready":
    case "live":
      return match.table_name;
    default:
      return null;
  }
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
    finished ? null : statusLabel(match),
    statusDetail(slot),
    finished ? `beendet, Sieger ${teamName(teamsMap, match.winner_team_id) ?? "unbekannt"}` : null,
    finished && match.cups_left != null ? `${match.cups_left} Becher übrig` : null,
  ]
    .filter(Boolean)
    .join(", ");
}
