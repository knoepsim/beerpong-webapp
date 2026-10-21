import type { BadgeVariant } from "@/components/ui/badge";
import type { MatchSlot } from "@/lib/bracket-layout";
import { cn } from "@/lib/utils";
import type { Match, Team } from "@/types";
import type { StationTerms } from "@/components/games";

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
  /** Its score at the end (what it counts is up to the game); null before the result. */
  score: number | null;
}

const teamName = (teamsMap: Record<string, Team>, id: string | null) =>
  id === null ? null : teamsMap[id]?.name || "Unbekannt";

/** Where a team comes from while it is not known: the winner of a match, or a place of a group ("A1"). */
function placeholderFor(source: number | null, groupPlace: string | null): string {
  if (groupPlace) return `${groupPlace.slice(1)}. Gruppe ${groupPlace[0]}`;
  return source === null ? "Offen" : `Sieger Spiel ${source}`;
}

/** The score of one side of a match (null before the result). */
const scoreOf = (match: Match, side: Side) => (side === "a" ? match.score_a : match.score_b);

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
      placeholder: placeholderFor(source, side === "a" ? match.source_a : match.source_b),
      isWinner,
      isChampion: id !== null && id === championTeamId,
      // a draw has no loser
      isLoser: finished && id !== null && match.winner_team_id !== null && !isWinner,
      score: finished && id !== null ? scoreOf(match, side) : null,
    };
  };
  return [build("a", match.team_a_id, sources.a), build("b", match.team_b_id, sources.b)];
}

/** The score as it is said for every game: "3:0" (team a first); null without one. */
export function scoreText(match: Pick<Match, "score_a" | "score_b">): string | null {
  return match.score_a != null && match.score_b != null ? `${match.score_a}:${match.score_b}` : null;
}

/** Both teams are known and there is no result yet: queued, at its station or live. */
export function isOpen(match: Match): boolean {
  return match.status === "queued" || match.status === "ready" || match.status === "live";
}

/**
 * The status as short as it stays clear next to its icon: "Wartet" (for a team, the rows name the matches it comes
 * from), "Nr. 2" (in the queue for a station), "Bereit", "Live", or the score ("3:0").
 */
export function statusLabel(match: Match): string {
  switch (match.status) {
    case "waiting":
      return "Wartet";
    case "queued":
      return match.queue_position != null ? `Nr. ${match.queue_position}` : "Wartet";
    case "ready":
      return "Bereit";
    case "live":
      return "Live";
    default:
      return scoreText(match) ?? "Beendet";
  }
}

/** The status in words, for screen readers and as tooltip of the badge; null for a finished match. */
export function statusText(match: Match, terms: StationTerms): string | null {
  switch (match.status) {
    case "waiting":
      return "Wartet auf Team";
    case "queued":
      return match.queue_position != null
        ? `Wartet auf ${terms.accusative}, Nr. ${match.queue_position} in der Warteschlange`
        : `Wartet auf ${terms.accusative}`;
    case "ready":
      return "Bereit";
    case "live":
      return "Läuft";
    default:
      return null;
  }
}

/** Badge colors by status: grey waits for a team, amber for a station, green can start, red is live. */
/**
 * The look of each open status, as a badge: waiting is quiet, the queue a warning, ready a success; live is the one
 * solid badge (white on red-600 keeps 4.5:1 in both themes).
 */
export const STATUS_BADGE = {
  waiting: { variant: "secondary" },
  queued: { variant: "warning" },
  ready: { variant: "success" },
  live: { variant: "default", className: "border-transparent bg-red-600 text-white" },
} as const satisfies Record<Exclude<Match["status"], "finished">, { variant: BadgeVariant; className?: string }>;

/**
 * The station to go to, only while it matters: at the station (ready), playing there (live), or still waiting for a
 * team when the API says the station is already certain. Never a guess.
 */
export function stationOf(match: Match): string | null {
  if (match.status === "ready" || match.status === "live") return match.station_name;
  return match.status === "waiting" ? match.upcoming_station_name : null;
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

/** One sentence for screen readers: number, teams with their colors, state and what it waits for, winner, score. */
export function matchSummary(
  slot: MatchSlot,
  sides: [SideInfo, SideInfo],
  teamsMap: Record<string, Team>,
  terms: StationTerms,
): string {
  const { match, number } = slot;
  const finished = match.status === "finished";
  return [
    `Spiel ${number}`,
    sides.map((s) => `${s.name ?? s.placeholder} (${SIDE_STYLE[s.side].label})`).join(" gegen "),
    statusText(match, terms),
    stationOf(match),
    finished && match.winner_team_id ? `beendet, Sieger ${teamName(teamsMap, match.winner_team_id) ?? "unbekannt"}` : null,
    finished && !match.winner_team_id ? "beendet, unentschieden" : null,
    finished && scoreText(match) ? `Ergebnis ${scoreText(match)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}
