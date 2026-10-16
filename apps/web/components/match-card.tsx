import { cn } from "@/lib/utils";
import { TeamLabel } from "@/components/team-label";
import type { MatchSlot } from "@/lib/bracket-layout";
import { MatchStatusBadge } from "@/components/match-status-badge";
import { MatchTable } from "@/components/match-table";
import { describeSides, matchSummary, sideTone, statusLabel } from "@/lib/match-display";
import type { Match, Team } from "@/types";

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
export function MatchCard({ slot, teamsMap, championTeamId, highlightTeamId, onClick }: Readonly<MatchCardProps>) {
  const { match, number } = slot;
  const sides = describeSides(slot, teamsMap, championTeamId);
  const mine = !!highlightTeamId && sides.some((s) => s.id === highlightTeamId);

  const className = cn(
    "block w-full rounded-lg border bg-card text-left shadow-xs overflow-hidden",
    // what is played right now or can start stands out
    (match.status === "ready" || match.status === "live") && "border-primary/50",
    mine && "ring-2 ring-primary/60",
    onClick && "cursor-pointer hover:border-primary/50 hover:shadow-md transition-shadow",
  );
  const content = (
    <>
      {/* one line: number, table, status (the bracket has a fixed height per slot) */}
      <div className="flex h-6 items-center gap-2 px-2 text-xs leading-4 text-muted-foreground">
        <span className="shrink-0 tabular-nums" title={`Spiel ${number}`}>
          {number}
        </span>
        <MatchTable match={match} className="min-w-0" />
        <span className="flex-1" />
        <MatchStatusBadge match={match} />
        {match.status === "finished" && (
          <span className="shrink-0" title="Becher, die dem Sieger übrig blieben">
            {statusLabel(match)}
          </span>
        )}
      </div>
      {sides.map((side) => (
        <div
          key={side.side}
          className={cn(
            "flex h-7 items-center gap-1 px-1.5 border-t text-[13px] leading-tight",
            sideTone(side, !!highlightTeamId && side.id === highlightTeamId),
          )}
        >
          <TeamLabel side={side} wrap={false} />
        </div>
      ))}
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

/** A team that skips round one. It has no match, so it gets a slim card of its own. */
export function ByeCard({
  teamId,
  teamsMap,
  highlightTeamId,
}: Readonly<{
  teamId: string;
  teamsMap: Record<string, Team>;
  highlightTeamId?: string | null;
}>) {
  const mine = !!highlightTeamId && teamId === highlightTeamId;
  const name = teamsMap[teamId]?.name || "Unbekannt";
  return (
    <article
      className={cn(
        "w-full rounded-lg border border-dashed bg-card/60 px-2 py-1.5 text-[13px] leading-none",
        mine && "ring-2 ring-primary/60 bg-primary/10",
      )}
      aria-label={`${name}, Freilos: ohne Spiel direkt in der nächsten Runde`}
    >
      <p className="text-xs leading-4 text-muted-foreground">Freilos</p>
      <p className="truncate font-medium pt-1">{name}</p>
    </article>
  );
}
