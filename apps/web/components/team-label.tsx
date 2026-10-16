import { Check, Trophy } from "lucide-react";
import type { SideInfo } from "@/lib/match-display";

/** A team's name (or where it comes from) with the trophy or check for the winner. Shared by card and row. */
export function TeamLabel({
  side,
  marker = true,
  wrap = true,
}: Readonly<{ side: SideInfo; marker?: boolean; /** false: one line, cut off (the full name is the tooltip) */ wrap?: boolean }>) {
  return (
    <>
      {side.name === null ? (
        <span className="italic text-muted-foreground">{side.placeholder}</span>
      ) : (
        // long names wrap onto a second line, or are cut off where the height is fixed (the bracket)
        <span className={wrap ? "line-clamp-2 break-words" : "min-w-0 truncate"} title={side.name}>
          {side.name}
        </span>
      )}
      {side.isChampion && <Trophy className="ml-auto w-3.5 h-3.5 shrink-0 text-amber-500" aria-label="Turniersieger" />}
      {marker && side.isWinner && !side.isChampion && (
        <Check className="ml-auto w-3.5 h-3.5 shrink-0 text-green-700 dark:text-green-400" aria-label="Gewinner" />
      )}
    </>
  );
}
