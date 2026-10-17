"use client";

import { useMemo, useState } from "react";
import { ChevronDown, MapPin, Play, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MatchRow } from "@/components/match-row";
import { MatchStatusBadge } from "@/components/match-status-badge";
import { useNow } from "@/hooks/use-now";
import { api } from "@/lib/api";
import { allMatchSlots, buildBracketLayout, type MatchSlot } from "@/lib/bracket-layout";
import { minutesSince, sinceLabel } from "@/lib/minutes";
import { cn } from "@/lib/utils";
import type { Bracket, Match, Team, TournamentTable } from "@/types";

/** A match at its table this long without a start: the teams may not have come. */
export const NOT_STARTED_WARNING_MINUTES = 5;

interface TablesBoardProps {
  bracket: Bracket;
  tables: TournamentTable[];
  teamsMap: Record<string, Team>;
  highlightTeamId?: string | null;
  /** Referees, managers and admins: start a match and open its result. */
  onResult?: (match: Match) => void;
  onChanged: () => void | Promise<void>;
}

function TableCard({
  table,
  slot,
  next,
  teamsMap,
  highlightTeamId,
  onResult,
  onChanged,
  now,
}: Readonly<{
  table: TournamentTable;
  slot: MatchSlot | undefined;
  next: MatchSlot | undefined;
  teamsMap: Record<string, Team>;
  highlightTeamId?: string | null;
  onResult?: (match: Match) => void;
  onChanged: () => void | Promise<void>;
  now: Date;
}>) {
  const [starting, setStarting] = useState(false);
  const match = slot?.match;
  const since = match?.status === "live" ? match.started_at : match?.on_table_at;
  const late =
    match?.status === "ready" && !!match.on_table_at && minutesSince(match.on_table_at, now) >= NOT_STARTED_WARNING_MINUTES;

  const start = async () => {
    if (!match) return;
    setStarting(true);
    try {
      await api.matches.start(match.id);
      toast.success(`Spiel ${slot?.number} an ${table.name} gestartet`);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Das Spiel konnte nicht gestartet werden. Versuch es noch einmal.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <li className={cn("space-y-2 rounded-xl border bg-card p-3", late && "border-warning/60")}>
      {/* the table name is what people look for: never cut off, the time goes to its own line */}
      <div className="flex items-start gap-2">
        <MapPin className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h3 className="min-w-0 flex-1 break-words text-lg font-semibold leading-snug">{table.name}</h3>
        {match ? (
          <MatchStatusBadge match={match} className="mt-1" />
        ) : (
          <span className="mt-1 text-xs font-medium text-muted-foreground">Frei</span>
        )}
      </div>
      {match && since && (
        <p className={cn("flex items-center gap-1 text-xs text-muted-foreground", late && "font-medium text-foreground")}>
          {late && <TriangleAlert className="size-3.5 shrink-0 text-warning" aria-hidden="true" />}
          {late ? `${sinceLabel(since, now)} nicht gestartet` : sinceLabel(since, now)}
        </p>
      )}
      {slot && <MatchRow slot={slot} teamsMap={teamsMap} highlightTeamId={highlightTeamId} aside={false} />}
      {next && (
        <p className="text-xs text-muted-foreground">
          Danach hier: Spiel {next.number}
        </p>
      )}
      {onResult && match && (
        <div className="flex gap-2">
          {match.status === "ready" && (
            <Button variant="outline" className="h-10 flex-1 gap-1.5" onClick={start} disabled={starting}>
              <Play className="size-4 fill-current" aria-hidden="true" />
              {starting ? "Wird gestartet..." : "Spiel starten"}
            </Button>
          )}
          <Button
            variant={match.status === "live" ? "default" : "outline"}
            className="h-10 flex-1"
            onClick={() => onResult(match)}
          >
            Ergebnis eintragen
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * What happens at every table right now, for everybody: the match at it (live or ready, and since when), free
 * tables, and the queue for the next free one. Organizers start matches and enter results right here, without
 * looking for the match in the bracket.
 */
export function TablesBoard({ bracket, tables, teamsMap, highlightTeamId, onResult, onChanged }: Readonly<TablesBoardProps>) {
  const now = useNow();
  const slots = useMemo(() => allMatchSlots(buildBracketLayout(bracket)), [bracket]);
  const atTable = (table: TournamentTable) =>
    slots.find((s) => (s.match.status === "ready" || s.match.status === "live") && s.match.table_id === table.id);
  const nextAt = (table: TournamentTable) =>
    slots.find((s) => s.match.status === "waiting" && s.match.upcoming_table_id === table.id);
  const queue = slots
    .filter((s) => s.match.status === "queued")
    .sort((a, b) => (a.match.queue_position ?? Infinity) - (b.match.queue_position ?? Infinity));

  const live = slots.filter((s) => s.match.status === "live").length;
  const ready = slots.filter((s) => s.match.status === "ready").length;
  const free = tables.length - live - ready;
  const summary = [
    live > 0 && `${live} live`,
    ready > 0 && `${ready} bereit`,
    free > 0 && `${free} frei`,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {summary.length > 0 && <p className="text-sm text-muted-foreground">{summary.join(" · ")}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            slot={atTable(table)}
            next={nextAt(table)}
            teamsMap={teamsMap}
            highlightTeamId={highlightTeamId}
            onResult={onResult}
            onChanged={onChanged}
            now={now}
          />
        ))}
      </ul>
      {/* the queue is there when needed, not in the way: closed by default */}
      {queue.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group flex h-11 w-full items-center justify-between rounded-xl border bg-card px-3 text-sm font-medium">
            Warteschlange ({queue.length})
            <ChevronDown
              className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="mt-2 space-y-2">
              {queue.map((slot) => (
                <li key={slot.match.id}>
                  <MatchRow slot={slot} teamsMap={teamsMap} highlightTeamId={highlightTeamId} onClick={onResult} />
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
