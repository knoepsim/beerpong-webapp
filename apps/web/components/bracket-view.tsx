"use client";

import { useMemo } from "react";
import type { Bracket, Match, Team } from "@/types";

interface BracketViewProps {
  bracket: Bracket;
  teamsMap: Record<string, Team>;
  onMatchClick?: (match: Match) => void;
}

export function BracketView({ bracket, teamsMap, onMatchClick }: BracketViewProps) {
  const matchesByRound = useMemo(() => {
    const rounds: Record<number, Match[]> = {};
    for (let i = 1; i <= bracket.total_rounds; i++) {
      rounds[i] = [];
    }
    for (const match of bracket.matches) {
      if (!rounds[match.round]) {
        rounds[match.round] = [];
      }
      rounds[match.round].push(match);
    }
    for (const round of Object.keys(rounds)) {
      rounds[Number(round)].sort((a, b) => a.position - b.position);
    }
    return rounds;
  }, [bracket]);

  const rounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="flex min-w-max gap-8 px-2 py-4">
        {rounds.map((round) => (
          <div key={round} className="flex flex-col min-w-[200px]">
            <h3 className="text-sm font-semibold text-center mb-6 text-muted-foreground uppercase tracking-wider">
              {round === bracket.total_rounds
                ? "Finale"
                : round === bracket.total_rounds - 1
                ? "Halbfinale"
                : `Runde ${round}`}
            </h3>
            
            <div className="flex flex-col justify-around flex-1" style={{ minHeight: `${matchesByRound[round].length * 100}px` }}>
              {matchesByRound[round].map((match) => {
                const teamA = match.team_a_id ? teamsMap[match.team_a_id]?.name || "Unbekannt" : "TBD";
                const teamB = match.team_b_id ? teamsMap[match.team_b_id]?.name || "Unbekannt" : "TBD";
                
                return (
                  <div
                    key={match.id}
                    className="relative flex flex-col justify-center py-2"
                  >
                    <button
                      onClick={() => onMatchClick?.(match)}
                      className={`w-full flex flex-col text-left rounded-lg border shadow-sm overflow-hidden text-sm bg-card transition-colors ${
                        onMatchClick ? "hover:border-primary/50 hover:bg-accent/50 cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <div className="flex items-center justify-between p-2.5 border-b">
                        <span className="truncate pr-2 font-medium">{teamA}</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-muted/20">
                        <span className="truncate pr-2 font-medium">{teamB}</span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
