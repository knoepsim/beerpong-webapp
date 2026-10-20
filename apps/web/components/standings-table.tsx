"use client";

import { useGame } from "@/components/game-context";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Standing, Team } from "@/types";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * The table where everybody plays everybody: rank, team, played, won, (drawn,) lost, difference, points. Draws only
 * appear where the game has them; my team is highlighted. Short heads with their meaning for screen readers.
 */
export function StandingsTable({
  standings,
  teamsMap,
  highlightTeamId,
}: Readonly<{ standings: Standing[]; teamsMap: Record<string, Team>; highlightTeamId?: string | null }>) {
  const draws = useGame()?.draws ?? standings.some((row) => row.drawn > 0);
  const number = "w-7 px-0.5 text-right tabular-nums";

  return (
    <Table>
      <TableCaption className="sr-only">Tabelle: 3 Punkte für einen Sieg, 1 für ein Unentschieden</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-6 px-0.5 text-right">
            <abbr title="Platz">#</abbr>
          </TableHead>
          <TableHead>Team</TableHead>
          <TableHead className={number}>
            <abbr title="Spiele">Sp</abbr>
          </TableHead>
          <TableHead className={number}>
            <abbr title="Siege">S</abbr>
          </TableHead>
          {draws && (
            <TableHead className={number}>
              <abbr title="Unentschieden">U</abbr>
            </TableHead>
          )}
          <TableHead className={number}>
            <abbr title="Niederlagen">N</abbr>
          </TableHead>
          <TableHead className={number}>
            <abbr title="Differenz">+/-</abbr>
          </TableHead>
          <TableHead className={cn(number, "pr-2")}>
            <abbr title="Punkte">Pkt</abbr>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((row) => (
          <TableRow
            key={row.team_id}
            aria-current={row.team_id === highlightTeamId ? "true" : undefined}
            className={cn(row.team_id === highlightTeamId && "bg-primary/10")}
          >
            <TableCell className="px-0.5 text-right tabular-nums text-muted-foreground">{row.rank}.</TableCell>
            <TableCell className="whitespace-normal break-words font-medium leading-tight">{teamsMap[row.team_id]?.name ?? "Unbekannt"}</TableCell>
            <TableCell className={number}>{row.played}</TableCell>
            <TableCell className={number}>{row.won}</TableCell>
            {draws && <TableCell className={number}>{row.drawn}</TableCell>}
            <TableCell className={number}>{row.lost}</TableCell>
            <TableCell className={number}>{signed(row.score_for - row.score_against)}</TableCell>
            <TableCell className={cn(number, "pr-2 font-semibold")}>{row.points}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
