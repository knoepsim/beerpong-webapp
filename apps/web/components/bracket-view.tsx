"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import type { Bracket, Match, Team } from "@/types";

interface BracketViewProps {
  bracket: Bracket;
  teamsMap: Record<string, Team>;
  tournamentWinnerTeamId?: string | null;
  onMatchClick?: (match: Match) => void;
}

export function BracketView({ bracket, teamsMap, tournamentWinnerTeamId, onMatchClick }: BracketViewProps) {
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
        className="flex min-w-max gap-1 px-2 py-4"
        style={{ minHeight: `${maxSlots * 110}px` }}
      >
        {rounds.map((round) => {
          const slots = Math.pow(2, bracket.total_rounds - round);

          return (
            <div key={round} className="flex flex-col min-w-[200px]">
              <h3 className="text-sm font-semibold text-center mb-6 text-muted-foreground uppercase tracking-wider">
                {round === bracket.total_rounds
                  ? "Finale"
                  : round === bracket.total_rounds - 1
                    ? "Halbfinale"
                    : `Runde ${round}`}
              </h3>

              <div className="flex flex-col justify-around flex-1">
                {Array.from({ length: slots }).map((_, pos) => {
                  const match = matchesByRound[round].find(m => m.position === pos);

                  if (!match) {
                    return (
                      <div key={`empty-${round}-${pos}`} className="relative flex flex-col justify-center py-2 invisible">
                        <div className="w-full h-[82px]"></div>
                      </div>
                    );
                  }

                  const teamA = match.team_a_id ? teamsMap[match.team_a_id]?.name || "Unbekannt" : "TBD";
                  const teamB = match.team_b_id ? teamsMap[match.team_b_id]?.name || "Unbekannt" : "TBD";

                  // Derive winner if team progressed to next round (won't work for finals unless we fetch results)
                  const isTeamAWinner = match.team_a_id && match.next_match_id
                    ? bracket.matches.find(m => m.id === match.next_match_id)?.team_a_id === match.team_a_id ||
                    bracket.matches.find(m => m.id === match.next_match_id)?.team_b_id === match.team_a_id
                    : false;

                  const isTeamBWinner = match.team_b_id && match.next_match_id
                    ? bracket.matches.find(m => m.id === match.next_match_id)?.team_a_id === match.team_b_id ||
                    bracket.matches.find(m => m.id === match.next_match_id)?.team_b_id === match.team_b_id
                    : false;

                  return (
                    <div
                      key={match.id}
                      className="relative flex flex-col justify-center py-2"
                    >
                      <button
                        onClick={() => onMatchClick?.(match)}
                        className={`w-full flex flex-col text-left rounded-lg border shadow-sm overflow-hidden text-sm bg-card transition-colors h-[82px] ${onMatchClick ? "hover:border-primary/50 hover:bg-accent/50 cursor-pointer" : "cursor-default"
                          }`}
                      >
                        <div
                          className={`flex flex-col px-3 text-sm font-medium h-1/2 justify-center border-b ${isTeamAWinner || (tournamentWinnerTeamId && tournamentWinnerTeamId === match.team_a_id) ? "bg-primary/5 font-bold text-foreground" : "text-muted-foreground"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate pr-2">{teamA}</span>
                            {tournamentWinnerTeamId && tournamentWinnerTeamId === match.team_a_id ? (
                              <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded flex items-center gap-1"><span className="text-[10px]">🏆</span> Sieger</span>
                            ) : isTeamAWinner ? (
                              <span className="text-muted-foreground/70 text-[10px] font-normal uppercase tracking-wider flex items-center gap-1"><Check className="w-3 h-3" /> Gewinner</span>
                            ) : null}
                          </div>
                        </div>

                        <div
                          className={`flex flex-col px-3 text-sm font-medium h-1/2 justify-center ${isTeamBWinner || (tournamentWinnerTeamId && tournamentWinnerTeamId === match.team_b_id) ? "bg-primary/5 font-bold text-foreground" : "bg-muted/10 text-muted-foreground"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate pr-2">{teamB}</span>
                            {tournamentWinnerTeamId && tournamentWinnerTeamId === match.team_b_id ? (
                              <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded flex items-center gap-1"><span className="text-[10px]">🏆</span> Sieger</span>
                            ) : isTeamBWinner ? (
                              <span className="text-muted-foreground/70 text-[10px] font-normal uppercase tracking-wider flex items-center gap-1"><Check className="w-3 h-3" /> Gewinner</span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </div>
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
