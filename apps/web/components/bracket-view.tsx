"use client";

import { useMemo } from "react";
import { MatchCard } from "@/components/match-card";
import type { Bracket, Match, Team } from "@/types";
import { roundLabel } from "@/lib/utils";

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
  const maxSlots = Math.pow(2, bracket.total_rounds - 1);

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div
        className="flex min-w-max gap-1 px-2"
        style={{ minHeight: `${maxSlots * 110}px` }}
      >
        {rounds.map((round) => {
          const slots = Math.pow(2, bracket.total_rounds - round);

          return (
            <div key={round} className="flex flex-col min-w-[220px]">
              <h3 className="text-sm font-semibold text-center mb-4 text-muted-foreground uppercase tracking-wider">
                {roundLabel(round, bracket.total_rounds)}
              </h3>

              <div className="flex flex-col justify-around flex-1">
                {Array.from({ length: slots }).map((_, pos) => {
                  const match = matchesByRound[round].find(m => m.position === pos);

                  if (!match) {
                    return (
                      <div key={`empty-${round}-${pos}`} className="relative flex flex-col justify-center py-2 invisible">
                        <div className="w-full h-[96px]"></div>
                      </div>
                    );
                  }

                  return (
                    <MatchCard
                      key={match.id}
                      match={match}
                      teamsMap={teamsMap}
                      // the trophy belongs to the final only, not to every earlier match of the champion
                      championTeamId={match.next_match_id === null ? bracket.champion_team_id : null}
                      onClick={onMatchClick}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
