import { Check, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchSlot } from "@/lib/bracket-layout";
import { describeSides, matchSummary, SIDE_STYLE, statusLabel, tableLabel, type SideInfo } from "@/lib/match-display";
import type { Match, Team } from "@/types";

function SideCell({ side, isMine }: { side: SideInfo; isMine: boolean }) {
  const colors = SIDE_STYLE[side.side];
  return (
    <div
      className={cn(
        "flex items-center gap-1 min-h-9 min-w-0 px-2 py-1 border-l-4 text-[13px] leading-tight",
        side.isLoser || side.name === null ? colors.stripeMuted : colors.stripe,
        isMine ? "bg-primary/10" : side.isWinner && colors.winnerBg,
        // the loser looks disabled and is crossed out, so the result reads without the check
        side.isLoser && "text-muted-foreground line-through decoration-muted-foreground/60",
      )}
    >
      {side.name === null ? (
        <span className="italic text-muted-foreground">{side.placeholder}</span>
      ) : (
        <span className="line-clamp-2 break-words" title={side.name}>
          {side.name}
        </span>
      )}
      {side.isChampion && <Trophy className="ml-auto w-3.5 h-3.5 shrink-0 text-amber-500" aria-label="Turniersieger" />}
      {side.isWinner && !side.isChampion && (
        <Check className="ml-auto w-3.5 h-3.5 shrink-0 text-green-700 dark:text-green-400" aria-label="Gewinner" />
      )}
    </div>
  );
}

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
export function MatchRow({ slot, teamsMap, championTeamId, highlightTeamId, onClick }: MatchRowProps) {
  const { match, number } = slot;
  const sides = describeSides(slot, teamsMap, championTeamId);
  const table = tableLabel(match);
  const mine = !!highlightTeamId && sides.some((s) => s.id === highlightTeamId);

  const className = cn(
    "w-full block rounded-lg border bg-card text-left overflow-hidden",
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
          {match.status === "ready" && <span className="inline-block size-1.5 mr-1 rounded-full bg-primary align-middle" aria-hidden="true" />}
          {statusLabel(match)}
        </span>
      </div>
      <div className="grid grid-cols-2 border-t divide-x">
        {sides.map((side) => (
          <SideCell key={side.side} side={side} isMine={!!highlightTeamId && side.id === highlightTeamId} />
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
    <div className={className} role="group" aria-label={summary}>
      {content}
    </div>
  );
}
