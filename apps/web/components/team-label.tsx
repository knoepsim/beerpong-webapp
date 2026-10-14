import { Check, Trophy } from "lucide-react";
import type { SideInfo } from "@/lib/match-display";

/** A team's name (or where it comes from) with the trophy or check for the winner. Shared by card and row. */
export function TeamLabel({ side }: Readonly<{ side: SideInfo }>) {
  return (
    <>
      {side.name === null ? (
        <span className="italic text-muted-foreground">{side.placeholder}</span>
      ) : (
        // long names wrap onto a second line instead of being cut off
        <span className="line-clamp-2 break-words" title={side.name}>
          {side.name}
        </span>
      )}
      {side.isChampion && <Trophy className="ml-auto w-3.5 h-3.5 shrink-0 text-amber-500" aria-label="Turniersieger" />}
      {side.isWinner && !side.isChampion && (
        <Check className="ml-auto w-3.5 h-3.5 shrink-0 text-green-700 dark:text-green-400" aria-label="Gewinner" />
      )}
    </>
  );
}
