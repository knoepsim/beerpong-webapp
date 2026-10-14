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

/**
 * The table of a match, only where it helps: a match that is waiting for teams has none to tell, a finished
 * match does not need one anymore. A match that can be played right now says "Tisch folgt" until the table
 * logic has assigned one.
 */
export function tableLabel(match: Match): string | null {
  if (match.status === "finished") return null;
  if (match.table_number != null) return `Tisch ${match.table_number}`;
  return match.status === "ready" ? "Tisch folgt" : null;
}

/** Short status for the corner of a card: Wartet / Bereit / "9 Becher" (cups the winner had left). */
export function statusLabel(match: Match): string {
  if (match.status === "waiting") return "Wartet";
  if (match.status === "ready") return "Bereit";
  return match.cups_left != null ? `${match.cups_left} Becher` : "Beendet";
}

const STATUS_WORD = { waiting: "wartet", ready: "bereit", finished: null } as const;

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

/** One sentence for screen readers: number, teams with their colors, state, winner, cups and table. */
export function matchSummary(slot: MatchSlot, sides: [SideInfo, SideInfo], teamsMap: Record<string, Team>): string {
  const { match, number } = slot;
  const finished = match.status === "finished";
  return [
    `Spiel ${number}`,
    sides.map((s) => `${s.name ?? s.placeholder} (${SIDE_STYLE[s.side].label})`).join(" gegen "),
    STATUS_WORD[match.status],
    finished ? `beendet, Sieger ${teamName(teamsMap, match.winner_team_id) ?? "unbekannt"}` : null,
    finished && match.cups_left != null ? `${match.cups_left} Becher übrig` : null,
    tableLabel(match),
  ]
    .filter(Boolean)
    .join(", ");
}
