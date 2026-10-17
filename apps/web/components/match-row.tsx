import { cn } from "@/lib/utils";
import { TeamLabel } from "@/components/team-label";
import type { MatchSlot } from "@/lib/bracket-layout";
import { MatchStatusBadge } from "@/components/match-status-badge";
import { MatchTable } from "@/components/match-table";
import { describeSides, matchSummary, sideTone } from "@/lib/match-display";
import type { Match, Team } from "@/types";

interface MatchRowProps {
  slot: MatchSlot;
  teamsMap: Record<string, Team>;
  championTeamId?: string | null;
  /** The team of the logged-in user, highlighted wherever it plays. */
  highlightTeamId?: string | null;
  /** Organizers open the result dialog by clicking a match. */
  onClick?: (match: Match) => void;
  /** Without the right-hand side, where status and table are shown around the row already (the tables tab). */
  aside?: boolean;
}

/** The right-hand side of a row: the status and the table to go to; a finished match has its score in the rows. */
function Aside({ match }: Readonly<{ match: Match }>) {
  if (match.status === "finished") return null;
  return (
    <div className="flex w-24 shrink-0 flex-col items-end justify-center gap-1 border-l px-2 py-1.5 text-right text-xs">
      <MatchStatusBadge match={match} />
      <MatchTable match={match} className="max-w-full justify-end font-medium" />
    </div>
  );
}

/**
 * A match as a list row, like a scoreboard: number | both teams | what matters now.
 * Used for the list of all matches and for "my matches", so both read the same.
 *
 * Each piece of information appears once: the winner is bold, the loser dimmed and crossed out, the cups they had
 * left stand next to them; status and table only exist for matches that are not finished.
 */
export function MatchRow({ slot, teamsMap, championTeamId, highlightTeamId, onClick, aside = true }: Readonly<MatchRowProps>) {
  const { match, number } = slot;
  const sides = describeSides(slot, teamsMap, championTeamId);

  const className = cn(
    "flex w-full items-stretch rounded-lg border bg-card text-left overflow-hidden",
    onClick && "cursor-pointer hover:border-primary/50 transition-colors",
  );
  const content = (
    <>
      <span
        className="flex w-9 shrink-0 items-center justify-center border-r text-xs tabular-nums text-muted-foreground"
        aria-hidden="true"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1 divide-y">
        {sides.map((side) => (
          <div
            key={side.side}
            className={cn(
              "flex min-h-9 items-center gap-1 px-2 py-1 text-[13px] leading-tight",
              sideTone(side, !!highlightTeamId && side.id === highlightTeamId, false),
            )}
          >
            <TeamLabel side={side} />
          </div>
        ))}
      </div>
      {aside && <Aside match={match} />}
    </>
  );
  const summary = matchSummary(slot, sides, teamsMap);

  return onClick ? (
    <button type="button" className={className} aria-label={summary} onClick={() => onClick(match)}>
      {content}
    </button>
  ) : (
    <article className={className} aria-label={summary}>
      {content}
    </article>
  );
}
