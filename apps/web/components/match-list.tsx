"use client";

import { useMemo } from "react";
import { MatchRow } from "@/components/match-row";
import { buildBracketLayout, buildGroupLayouts, isMatchSlot, roundTitle } from "@/lib/bracket-layout";
import type { Bracket, Match, Team } from "@/types";

interface MatchListProps {
  bracket: Bracket;
  teamsMap: Record<string, Team>;
  highlightTeamId?: string | null;
  /** Organizers open the result dialog by clicking a match. */
  onMatchClick?: (match: Match) => void;
  /** Only these matches (e.g. the open ones); rounds without one are left out. */
  include?: (match: Match) => boolean;
  /** The matches of this group (day by day) instead of the tree or the match days of the tournament. */
  group?: number;
}

/** Every match of the tournament, round by round, in the same compact row as "my matches". */
export function MatchList({ bracket, teamsMap, highlightTeamId, onMatchClick, include, group }: Readonly<MatchListProps>) {
  const layout = useMemo(
    () => (group ? buildGroupLayouts(bracket).find((g) => g.group === group)?.layout : undefined) ?? buildBracketLayout(bracket),
    [bracket, group],
  );

  return (
    <div className="space-y-5">
      {layout.rounds.map((round) => {
        const slots = round.slots.filter(isMatchSlot).filter((s) => !include || include(s.match));
        if (slots.length === 0) return null;
        return (
          <section key={round.round} aria-label={roundTitle(layout, round.round)}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {roundTitle(layout, round.round)}
            </h4>
            <ul className="space-y-2">
              {slots.map((slot) => (
                <li key={slot.match.id}>
                  <MatchRow
                    slot={slot}
                    teamsMap={teamsMap}
                    // the trophy belongs to the final of a knock-out; in a table it shows on the podium
                    championTeamId={
                      layout.kind === "tree" && round.round === layout.totalRounds
                        ? bracket.champion_team_id
                        : null
                    }
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
