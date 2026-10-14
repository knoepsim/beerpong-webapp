import { cn } from "@/lib/utils";
import { TeamLabel } from "@/components/team-label";
import type { MatchSlot } from "@/lib/bracket-layout";
import { describeSides, matchSummary, sideTone, tableLabel } from "@/lib/match-display";
import type { Match, Team } from "@/types";

interface MatchRowProps {
  slot: MatchSlot;
  teamsMap: Record<string, Team>;
  championTeamId?: string | null;
  /** The team of the logged-in user, highlighted wherever it plays. */
  highlightTeamId?: string | null;
  /** Organizers open the result dialog by clicking a match. */
  onClick?: (match: Match) => void;
}

/** The right-hand side of a row: only what belongs to the state of the match, nothing for a waiting one. */
function Aside({ match }: Readonly<{ match: Match }>) {
  const table = tableLabel(match);
  const cups = match.status === "finished" ? match.cups_left : null;
  if (match.status === "ready" || table || cups != null) {
    return (
      <div className="flex w-[5.5rem] shrink-0 flex-col items-end justify-center gap-1 border-l px-2 py-1.5 text-right text-xs">
        {match.status === "ready" && (
          <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground">Bereit</span>
        )}
        {table && <span className="font-medium">{table}</span>}
        {cups != null && <span className="text-balance text-muted-foreground">{cups} Becher übrig</span>}
      </div>
    );
  }
  return null;
}

/**
 * A match as a list row, like a scoreboard: number | both teams | what matters now.
 * Used for the list of all matches and for "my matches", so both read the same.
 *
 * Each piece of information appears once: the winner is bold, the loser dimmed and crossed out; "Bereit" and
 * the table only exist for matches that can be played; the cups only for finished ones.
 */
export function MatchRow({ slot, teamsMap, championTeamId, highlightTeamId, onClick }: Readonly<MatchRowProps>) {
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
              side.isWinner && "font-semibold",
              side.isLoser && "line-through decoration-muted-foreground/60",
            )}
          >
            <TeamLabel side={side} marker={false} />
          </div>
        ))}
      </div>
      <Aside match={match} />
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
