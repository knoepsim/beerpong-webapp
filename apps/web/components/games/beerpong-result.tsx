"use client";

import { useState } from "react";
import { BeerpongTable } from "@/components/games/beerpong-table";
import type { ResultInputProps, TeamBasic } from "@/components/games";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** The cups each team starts with; the winner has 1 to all of them left, the loser none. */
const CUPS = 10;

const SIDES = {
  a: {
    card: "border-red-500 bg-red-500/5 ring-1 ring-red-500",
    dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]",
    idleDot: "bg-red-500/50",
    label: "text-red-600 dark:text-red-400",
    input: "border-red-500/30 focus-visible:ring-red-500",
  },
  b: {
    card: "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500",
    dot: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]",
    idleDot: "bg-blue-500/50",
    label: "text-blue-600 dark:text-blue-400",
    input: "border-blue-500/30 focus-visible:ring-blue-500",
  },
};

/**
 * Beer pong: tap the winner, then (optionally) the cups it had left; the loser has none, so the score is always
 * "cups : 0". Without an entry the winner had all cups left (what the placeholder shows is what is saved).
 */
export function BeerpongResult({ teamA, teamB, initial, locked, onChange }: Readonly<ResultInputProps>) {
  const [winnerId, setWinnerId] = useState<string | null>(initial?.winnerTeamId ?? null);
  const initialCups = initial ? Math.max(initial.scoreA, initial.scoreB) : null;
  const [cupsText, setCupsText] = useState(initialCups !== null && initialCups !== CUPS ? String(initialCups) : "");
  // tapping the winner puts the cursor into its cups field (on a phone the number pad opens right away);
  // opening a saved result does not
  const [tapped, setTapped] = useState(false);
  const cups = cupsText.trim() ? Number.parseInt(cupsText, 10) : CUPS;

  // before a winner both have all cups; then the winner what it had left, the loser none
  const cupsOn = (team: TeamBasic) => {
    if (winnerId === null) return CUPS;
    return winnerId === team.id ? cups : 0;
  };

  const report = (winner: string | null, left: number) =>
    onChange(winner ? { winnerTeamId: winner, scoreA: winner === teamA.id ? left : 0, scoreB: winner === teamB.id ? left : 0 } : null);

  const choose = (team: TeamBasic) => {
    if (locked) return;
    setWinnerId(team.id);
    setTapped(true);
    report(team.id, cups);
  };
  const changeCups = (text: string) => {
    setCupsText(text);
    report(winnerId, text.trim() ? Number.parseInt(text, 10) : CUPS);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <BeerpongTable
          leftCups={cupsOn(teamA)}
          rightCups={cupsOn(teamB)}
          compact
          className="w-full"
        />
      </div>
      <Label className="text-base">Wer hat gewonnen?</Label>
      <div className="grid grid-cols-2 gap-3">
        {([
          [teamA, "a"],
          [teamB, "b"],
        ] as const).map(([team, side]) => (
          <WinnerCard
            key={team.id}
            team={team}
            side={side}
            isWinner={winnerId === team.id}
            locked={locked}
            focusCups={tapped}
            cupsText={cupsText}
            onChoose={() => choose(team)}
            onCupsChange={changeCups}
          />
        ))}
      </div>
    </div>
  );
}

/** A team to tap as the winner; the winner gets the field for its cups left. */
function WinnerCard({
  team,
  side,
  isWinner,
  locked,
  focusCups,
  cupsText,
  onChoose,
  onCupsChange,
}: Readonly<{
  team: TeamBasic;
  side: keyof typeof SIDES;
  isWinner: boolean;
  locked: boolean;
  focusCups: boolean;
  cupsText: string;
  onChoose: () => void;
  onCupsChange: (text: string) => void;
}>) {
  const tone = SIDES[side];
  const inputId = `cups_${side}`;
  return (
    <button
      type="button"
      className={cn(
        "relative border-2 rounded-xl p-4 flex flex-col items-center justify-start transition-all min-h-[140px]",
        isWinner ? tone.card : "border-border bg-card hover:bg-accent/50",
        locked && "opacity-50 cursor-not-allowed",
      )}
      onClick={onChoose}
      disabled={locked}
    >
      <div className="flex flex-col items-center gap-2 w-full">
        <div className={cn("w-4 h-4 rounded-full", isWinner ? tone.dot : tone.idleDot)} />
        <span className="font-semibold text-center leading-tight">{team.name}</span>
      </div>
      {isWinner && (
        <div
          className="mt-auto pt-3 w-full animate-in fade-in zoom-in-95 duration-200"
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Label htmlFor={inputId} className={cn("text-xs font-medium", tone.label)}>
            Übrige Becher
          </Label>
          <Input
            id={inputId}
            autoFocus={focusCups}
            onFocus={(e) => e.target.select()}
            type="number"
            inputMode="numeric"
            min={1}
            max={CUPS}
            placeholder={String(CUPS)}
            value={cupsText}
            onChange={(e) => {
              const val = e.target.value;
              const value = Number.parseInt(val, 10);
              if (val === "" || (value >= 1 && value <= CUPS)) onCupsChange(val);
            }}
            className={cn("mt-1.5 text-center text-lg h-10 bg-background", tone.input)}
            disabled={locked}
          />
        </div>
      )}
    </button>
  );
}
