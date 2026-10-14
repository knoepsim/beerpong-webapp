import { cn } from "@/lib/utils";
import { TeamLabel } from "@/components/team-label";
import type { MatchSlot } from "@/lib/bracket-layout";
import { describeSides, matchSummary, sideTone, statusLabel, tableLabel } from "@/lib/match-display";
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

/**
 * A match as a compact list row: "Spiel 13 · Tisch 2 · Status" above, both teams side by side below.
 * Used for the list of all matches and for "my matches", so both read the same.
 */
export function MatchRow({ slot, teamsMap, championTeamId, highlightTeamId, onClick }: Readonly<MatchRowProps>) {
  const { match, number } = slot;
  const sides = describeSides(slot, teamsMap, championTeamId);
  const table = tableLabel(match);
  const mine = !!highlightTeamId && sides.some((s) => s.id === highlightTeamId);

  const className = cn(
    "block w-full rounded-lg border bg-card text-left overflow-hidden",
    match.status === "ready" && "border-primary/50",
    mine && "ring-2 ring-primary/60",
    onClick && "cursor-pointer hover:border-primary/50 hover:shadow-md transition-shadow",
  );
  const content = (
    <>
      <div className="flex items-center justify-between gap-2 px-2.5 pt-1.5 pb-1 text-xs leading-4 text-muted-foreground">
        <span className="truncate">
          Spiel {number}
          {table && ` · ${table}`}
        </span>
        <span className={cn("shrink-0", match.status === "ready" && "font-medium text-primary")}>
          {match.status === "ready" && (
            <span className="inline-block size-1.5 mr-1 rounded-full bg-primary align-middle" aria-hidden="true" />
          )}
          {statusLabel(match)}
        </span>
      </div>
      <div className="grid grid-cols-2 border-t divide-x">
        {sides.map((side) => (
          <div
            key={side.side}
            className={cn(
              "flex items-center gap-1 min-h-9 min-w-0 px-2 py-1 text-[13px] leading-tight",
              sideTone(side, !!highlightTeamId && side.id === highlightTeamId),
              // the loser looks disabled and is crossed out, so the result reads without the check
              side.isLoser && "line-through decoration-muted-foreground/60",
            )}
          >
            <TeamLabel side={side} />
          </div>
        ))}
      </div>
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
