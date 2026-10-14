import { Check, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchSlot } from "@/lib/bracket-layout";
import { describeSides, matchSummary, SIDE_STYLE, statusLabel, tableLabel, type SideInfo } from "@/lib/match-display";
import type { Match, Team } from "@/types";

function TeamRow({ side, isMine }: { side: SideInfo; isMine: boolean }) {
  const colors = SIDE_STYLE[side.side];
  return (
    <div
      className={cn(
        "flex items-center gap-1 min-h-8 px-1.5 py-1 border-t border-l-4 text-[13px] leading-tight",
        // the stripe stays strong until the match is decided, then only the winner keeps it
        side.isLoser || side.name === null ? colors.stripeMuted : colors.stripe,
        isMine ? "bg-primary/10" : side.isWinner && colors.winnerBg,
        side.isLoser && "text-muted-foreground",
      )}
    >
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
    </div>
  );
}

interface MatchCardProps {
  slot: MatchSlot;
  teamsMap: Record<string, Team>;
  /** Only set for the final: the trophy belongs there. */
  championTeamId?: string | null;
  /** The team of the logged-in user, highlighted wherever it plays. */
  highlightTeamId?: string | null;
  onClick?: (match: Match) => void;
}

/** One match in the bracket: number, table, status and both teams. The state comes from the API. */
export function MatchCard({ slot, teamsMap, championTeamId, highlightTeamId, onClick }: MatchCardProps) {
  const { match, number } = slot;
  const sides = describeSides(slot, teamsMap, championTeamId);
  const table = tableLabel(match);
  const mine = !!highlightTeamId && sides.some((s) => s.id === highlightTeamId);

  const className = cn(
    "w-full rounded-lg border bg-card text-left shadow-xs overflow-hidden",
    // what can be played right now stands out
    match.status === "ready" && "border-primary/50",
    mine && "ring-2 ring-primary/60",
    onClick && "cursor-pointer hover:border-primary/50 hover:shadow-md transition-shadow",
  );
  const content = (
    <>
      <div className="px-2 pt-1 pb-1 text-xs leading-4 text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">Spiel {number}</span>
          {match.status === "ready" && (
            <span className="inline-flex items-center gap-1 shrink-0 font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              {statusLabel(match)}
            </span>
          )}
          {match.status === "finished" && (
            <span className="shrink-0" title="Becher, die dem Sieger übrig blieben">
              {statusLabel(match)}
            </span>
          )}
        </div>
        {table && <div className="truncate">{table}</div>}
      </div>
      {sides.map((side) => (
        <TeamRow key={side.side} side={side} isMine={!!highlightTeamId && side.id === highlightTeamId} />
      ))}
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

/** A team that skips round one. It has no match, so it gets a slim card of its own. */
export function ByeCard({
  teamId,
  teamsMap,
  highlightTeamId,
}: {
  teamId: string;
  teamsMap: Record<string, Team>;
  highlightTeamId?: string | null;
}) {
  const mine = !!highlightTeamId && teamId === highlightTeamId;
  const name = teamsMap[teamId]?.name || "Unbekannt";
  return (
    <div
      className={cn(
        "w-full rounded-lg border border-dashed bg-card/60 px-2 py-1.5 text-[13px] leading-none",
        mine && "ring-2 ring-primary/60 bg-primary/10",
      )}
      role="group"
      aria-label={`${name}, Freilos: ohne Spiel direkt in der nächsten Runde`}
    >
      <p className="text-xs leading-4 text-muted-foreground">Freilos</p>
      <p className="truncate font-medium pt-1">{name}</p>
    </div>
  );
}
