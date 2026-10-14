"use client";

import { useMemo } from "react";
import { MatchRow } from "@/components/match-row";
import { buildBracketLayout, isMatchSlot } from "@/lib/bracket-layout";
import { roundLabel } from "@/lib/utils";
import type { Bracket, Match, Team } from "@/types";

interface MatchListProps {
  bracket: Bracket;
  teamsMap: Record<string, Team>;
  highlightTeamId?: string | null;
  /** Organizers open the result dialog by clicking a match. */
  onMatchClick?: (match: Match) => void;
}

/** Every match of the tournament, round by round, in the same compact row as "my matches". */
export function MatchList({ bracket, teamsMap, highlightTeamId, onMatchClick }: MatchListProps) {
  const layout = useMemo(() => buildBracketLayout(bracket), [bracket]);

  return (
    <div className="space-y-5">
      {layout.rounds.map((round) => {
        const slots = round.slots.filter(isMatchSlot);
        if (slots.length === 0) return null;
        return (
          <section key={round.round} aria-label={roundLabel(round.round, layout.totalRounds)}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {roundLabel(round.round, layout.totalRounds)}
            </h4>
            <ul className="space-y-2">
              {slots.map((slot) => (
                <li key={slot.match.id}>
                  <MatchRow
                    slot={slot}
                    teamsMap={teamsMap}
                    championTeamId={round.round === layout.totalRounds ? bracket.champion_team_id : null}
                    highlightTeamId={highlightTeamId}
                    onClick={onMatchClick}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
