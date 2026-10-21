"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useStartKnockout } from "@/hooks/queries/tournaments";
import { groupLetter, moveWithinRank, openTies } from "@/lib/groups";
import type { Bracket, Standing, Team, Tournament } from "@/types";

const MOVES = [
  { step: -1, label: "nach oben", Icon: ArrowUp },
  { step: 1, label: "nach unten", Icon: ArrowDown },
] as const;

/** The teams of a group that share a place that matters, in the order the organization gives them (up / down). */
function TieOrder({
  group,
  standings,
  advance,
  order,
  name,
  onChange,
}: Readonly<{
  group: number;
  standings: Standing[];
  advance: number;
  order: string[];
  name: (id: string) => string;
  onChange: (order: string[]) => void;
}>) {
  const tied = new Set(openTies(standings, advance).flat());
  return (
    <section aria-label={`Gleichstand in Gruppe ${groupLetter(group)}`} className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Gleichstand in Gruppe {groupLetter(group)}: Lege die Reihenfolge fest.</p>
      <ol className="space-y-1">
        {order.map((id, i) =>
          tied.has(id) ? (
            <li key={id} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-right tabular-nums text-muted-foreground">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{name(id)}</span>
              {MOVES.map(({ step, label, Icon }) => {
                const next = moveWithinRank(order, standings, id, step);
                return (
                  <Button
                    key={label}
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    disabled={next === order}
                    onClick={() => onChange(next)}
                    aria-label={`${name(id)} ${label}`}
                  >
                    <Icon aria-hidden="true" />
                  </Button>
                );
              })}
            </li>
          ) : null,
        )}
      </ol>
    </section>
  );
}

/**
 * After the group stage the organization starts the knock-out: who goes on is shown group by group; where teams share
 * a place that matters, the organization puts them in order (only among each other). Starting fixes the groups.
 */
export function KnockoutStart({
  tournament,
  bracket,
  teamsMap,
}: Readonly<{ tournament: Tournament; bracket: Bracket; teamsMap: Record<string, Team> }>) {
  const confirm = useConfirm();
  const start = useStartKnockout(tournament.id);
  const advance = tournament.advance_per_group ?? 1;
  const groups = bracket.groups ?? [];
  // the order of every group: the table, changed by the organization where teams share a place
  const [orders, setOrders] = useState<Record<number, string[]>>({});
  const orderOf = (group: number) =>
    orders[group] ?? groups.find((g) => g.group === group)!.standings.map((row) => row.team_id);
  const open = bracket.matches.filter((m) => m.group !== null && m.status !== "finished").length;
  const name = (id: string) => teamsMap[id]?.name ?? "Unbekannt";

  if (open > 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Die K.-o.-Runde kann starten, wenn alle Gruppenspiele ein Ergebnis haben. Noch {open === 1 ? "1 Spiel" : `${open} Spiele`} offen.
      </p>
    );
  }

  const tied = groups.filter((g) => openTies(g.standings, advance).length > 0);
  const qualifiers = groups.map((g) => `Gruppe ${groupLetter(g.group)}: ${orderOf(g.group).slice(0, advance).map(name).join(", ")}`);

  const handleStart = () =>
    void confirm({
      title: "K.-o.-Runde starten?",
      description: `Weiter kommen: ${qualifiers.join("; ")}. Die Ergebnisse der Gruppen stehen danach fest.`,
      confirmLabel: "K.-o.-Runde starten",
      action: async () => {
        await start.mutateAsync(Object.fromEntries(tied.map((g) => [g.group, orderOf(g.group)])));
      },
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Alle Gruppenspiele haben ein Ergebnis.</p>
      {tied.map((g) => (
        <TieOrder
          key={g.group}
          group={g.group}
          standings={g.standings}
          advance={advance}
          order={orderOf(g.group)}
          name={name}
          onChange={(next) => setOrders((prev) => ({ ...prev, [g.group]: next }))}
        />
      ))}
      <Button onClick={handleStart} disabled={start.isPending} className="w-full sm:w-auto" size="lg">
        {start.isPending ? "Wird gestartet…" : "K.-o.-Runde starten"}
      </Button>
    </div>
  );
}
