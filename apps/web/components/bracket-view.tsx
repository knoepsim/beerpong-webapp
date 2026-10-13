"use client";

import { useMemo } from "react";
import { Check, Clock, Trophy, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
        className="flex min-w-max gap-1 px-2"
        style={{ minHeight: `${maxSlots * 110}px` }}
      >
        {rounds.map((round) => {
          const slots = Math.pow(2, bracket.total_rounds - round);

          return (
            <div key={round} className="flex flex-col min-w-[220px]">
              <h3 className="text-sm font-semibold text-center mb-4 text-muted-foreground uppercase tracking-wider">
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
                        <div className="w-full h-[96px]"></div>
                      </div>
                    );
                  }

                  const teamA = match.team_a_id ? teamsMap[match.team_a_id]?.name || "Unbekannt" : "TBD";
                  const teamB = match.team_b_id ? teamsMap[match.team_b_id]?.name || "Unbekannt" : "TBD";

                  const isTeamAWinner = match.team_a_id && match.next_match_id
                    ? bracket.matches.find(m => m.id === match.next_match_id)?.team_a_id === match.team_a_id ||
                    bracket.matches.find(m => m.id === match.next_match_id)?.team_b_id === match.team_a_id
                    : false;

                  const isTeamBWinner = match.team_b_id && match.next_match_id
                    ? bracket.matches.find(m => m.id === match.next_match_id)?.team_a_id === match.team_b_id ||
                    bracket.matches.find(m => m.id === match.next_match_id)?.team_b_id === match.team_b_id
                    : false;

                  const hasResult = isTeamAWinner || isTeamBWinner;
                  const bothTeamsSet = match.team_a_id && match.team_b_id;
                  const isTournamentWinnerA = tournamentWinnerTeamId && tournamentWinnerTeamId === match.team_a_id;
                  const isTournamentWinnerB = tournamentWinnerTeamId && tournamentWinnerTeamId === match.team_b_id;

                  return (
                    <div
                      key={match.id}
                      className="relative flex flex-col justify-center py-2"
                    >
                      {/* Meta info row: Table + Timer */}
                      {bothTeamsSet && (
                        <div className="flex items-center justify-between px-1 mb-1">
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal text-muted-foreground">
                              <Hash className="w-2.5 h-2.5" />
                              Tisch 12
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            {hasResult ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal">
                                <Check className="w-2.5 h-2.5" />
                                Beendet
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal text-muted-foreground">
                                <Clock className="w-2.5 h-2.5" />
                                12:34
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => onMatchClick?.(match)}
                        className={`w-full flex flex-col text-left rounded-lg border overflow-hidden text-sm bg-card transition-all ${
                          onMatchClick ? "hover:border-primary/50 hover:shadow-md cursor-pointer" : "cursor-default"
                        } shadow-sm`}
                      >
                        {/* Team A row */}
                        <div
                          className={`flex items-center h-[40px] border-b transition-colors ${
                            isTournamentWinnerA
                              ? "bg-primary/10 font-bold text-foreground"
                              : isTeamAWinner
                                ? "bg-red-500/5 font-semibold text-foreground"
                                : hasResult
                                  ? "text-muted-foreground/60"
                                  : "text-foreground"
                          }`}
                        >
                          {/* Color stripe */}
                          <div className={`w-1 h-full shrink-0 ${
                            isTeamAWinner || isTournamentWinnerA ? "bg-red-500" : "bg-red-500/30"
                          }`} />
                          <div className="flex items-center justify-between flex-1 px-2.5 min-w-0">
                            <span className="truncate pr-2 text-sm">{teamA}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {bothTeamsSet && (
                                <span className={`text-xs tabular-nums font-bold ${
                                  isTeamAWinner || isTournamentWinnerA ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                                }`}>
                                  10
                                </span>
                              )}
                              {isTournamentWinnerA && (
                                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                              )}
                              {isTeamAWinner && !isTournamentWinnerA && (
                                <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Team B row */}
                        <div
                          className={`flex items-center h-[40px] transition-colors ${
                            isTournamentWinnerB
                              ? "bg-primary/10 font-bold text-foreground"
                              : isTeamBWinner
                                ? "bg-blue-500/5 font-semibold text-foreground"
                                : hasResult
                                  ? "text-muted-foreground/60"
                                  : "text-foreground"
                          }`}
                        >
                          <div className={`w-1 h-full shrink-0 ${
                            isTeamBWinner || isTournamentWinnerB ? "bg-blue-500" : "bg-blue-500/30"
                          }`} />
                          <div className="flex items-center justify-between flex-1 px-2.5 min-w-0">
                            <span className="truncate pr-2 text-sm">{teamB}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {bothTeamsSet && (
                                <span className={`text-xs tabular-nums font-bold ${
                                  isTeamBWinner || isTournamentWinnerB ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                                }`}>
                                  10
                                </span>
                              )}
                              {isTournamentWinnerB && (
                                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                              )}
                              {isTeamBWinner && !isTournamentWinnerB && (
                                <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                              )}
                            </div>
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
