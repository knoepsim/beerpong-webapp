"use client";

import { useState } from "react";
import type { ResultInputProps, TeamBasic } from "@/components/games";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const parse = (text: string) => (text.trim() === "" ? null : Number.parseInt(text, 10));

/** The team with more goals; null for a draw. */
function winnerOf(a: number, b: number, teamA: TeamBasic, teamB: TeamBasic): string | null {
  if (a === b) return null;
  return a > b ? teamA.id : teamB.id;
}

/**
 * Football: the goals of both teams, the winner follows from them. A knock-out match needs a winner, so there a
 * draw is no result: extra time and penalties count into the score. Where everybody plays everybody a draw counts
 * (the same rules as the API).
 */
export function FootballResult({ teamA, teamB, initial, locked, allowDraw, onChange }: Readonly<ResultInputProps>) {
  const [goals, setGoals] = useState({
    a: initial ? String(initial.scoreA) : "",
    b: initial ? String(initial.scoreB) : "",
  });
  const a = parse(goals.a);
  const b = parse(goals.b);
  const draw = a !== null && b !== null && a === b;

  const change = (side: "a" | "b", text: string) => {
    const value = parse(text);
    if (value !== null && (Number.isNaN(value) || value < 0 || value > 99)) return;
    const next = { ...goals, [side]: text };
    setGoals(next);
    const [scoreA, scoreB] = [parse(next.a), parse(next.b)];
    if (scoreA === null || scoreB === null || (scoreA === scoreB && !allowDraw)) return onChange(null);
    onChange({ winnerTeamId: winnerOf(scoreA, scoreB, teamA, teamB), scoreA, scoreB });
  };

  return (
    <fieldset className="space-y-3" disabled={locked}>
      <legend className="text-base font-medium">Wie ist es ausgegangen?</legend>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <GoalField team={teamA} side="a" value={goals.a} onChange={(text) => change("a", text)} autoFocus={!initial} />
        <span className="pb-3 text-2xl font-semibold text-muted-foreground" aria-hidden="true">
          :
        </span>
        <GoalField team={teamB} side="b" value={goals.b} onChange={(text) => change("b", text)} />
      </div>
      {draw && !allowDraw && (
        <p role="status" className="text-sm text-muted-foreground">
          Unentschieden gibt es hier nicht: Trag das Ergebnis nach Verlängerung oder Elfmeterschießen ein.
        </p>
      )}
    </fieldset>
  );
}

function GoalField({
  team,
  side,
  value,
  onChange,
  autoFocus = false,
}: Readonly<{ team: TeamBasic; side: "a" | "b"; value: string; onChange: (text: string) => void; autoFocus?: boolean }>) {
  const id = `goals_${side}`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="flex min-w-0 items-center gap-2">
        <span className={cn("size-3 shrink-0 rounded-full", side === "a" ? "bg-red-500" : "bg-blue-500")} aria-hidden="true" />
        <span className="truncate">{team.name}</span>
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={value}
        autoFocus={autoFocus}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Tore ${team.name}`}
        className="h-14 text-center text-2xl tabular-nums"
      />
    </div>
  );
}
