import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SideInfo } from "@/lib/match-display";

/**
 * A team's name (or where it comes from) like on a scoreboard: the cups it had left at the end on the right, the
 * winner bold, the loser crossed out (not only by color). The champion gets the trophy. Shared by card and row.
 */
export function TeamLabel({
  side,
  wrap = true,
}: Readonly<{ side: SideInfo; /** false: one line, cut off (the full name is the tooltip) */ wrap?: boolean }>) {
  return (
    <>
      {side.name === null ? (
        <span className="italic text-muted-foreground">{side.placeholder}</span>
      ) : (
        // long names wrap onto a second line, or are cut off where the height is fixed (the bracket)
        <span
          className={cn(
            wrap ? "line-clamp-2 break-words" : "min-w-0 truncate",
            side.isWinner && "font-semibold",
            side.isLoser && "line-through decoration-muted-foreground/60",
          )}
          title={side.name}
        >
          {side.name}
        </span>
      )}
      {(side.isChampion || side.score !== null) && (
        <span className="ml-auto flex shrink-0 items-center gap-1 pl-1">
          {side.isChampion && <Trophy className="size-3.5 text-amber-500" aria-label="Turniersieger" />}
          {side.score !== null && (
            <span className={cn("tabular-nums", side.isWinner && "font-semibold")}>{side.score}</span>
          )}
        </span>
      )}
    </>
  );
}
