import type { MatchSlot } from "@/lib/bracket-layout";
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
 * The table of a match. Tables are handed out by the organizer logic; until a match has one, matches that
 * are still to be played say so, finished matches show nothing.
 */
export function tableLabel(match: Match): string | null {
  if (match.table_number != null) return `Tisch ${match.table_number}`;
  return match.status === "finished" ? null : "Tisch folgt";
}

/** Short status for the corner of a card: Wartet / Bereit / "9 Becher" (cups the winner had left). */
export function statusLabel(match: Match): string {
  if (match.status === "waiting") return "Wartet";
  if (match.status === "ready") return "Bereit";
  return match.cups_left != null ? `${match.cups_left} Becher` : "Beendet";
}

/** One sentence for screen readers: number, teams with their colors, state, winner, cups and table. */
export function matchSummary(slot: MatchSlot, sides: [SideInfo, SideInfo], teamsMap: Record<string, Team>): string {
  const { match, number } = slot;
  const table = tableLabel(match);
  return [
    `Spiel ${number}`,
    sides.map((s) => `${s.name ?? s.placeholder} (${SIDE_STYLE[s.side].label})`).join(" gegen "),
    match.status === "ready" ? "bereit" : match.status === "waiting" ? "wartet" : null,
    match.status === "finished" ? `beendet, Sieger ${teamName(teamsMap, match.winner_team_id) ?? "unbekannt"}` : null,
    match.status === "finished" && match.cups_left != null ? `${match.cups_left} Becher übrig` : null,
    table,
  ]
    .filter(Boolean)
    .join(", ");
}
