"use client";

import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { MatchRow } from "@/components/match-row";
import { allMatchSlots, buildBracketLayout, type MatchSlot } from "@/lib/bracket-layout";
import { roundLabel } from "@/lib/utils";
import type { Bracket, Match, Team } from "@/types";

interface MyMatchesProps {
  bracket: Bracket;
  teamsMap: Record<string, Team>;
  /** The team of the logged-in user. */
  teamId: string;
  onMatchClick?: (match: Match) => void;
}

/** What to say when nothing is left to play. */
function NothingToPlay({ matches, bracket, teamId }: Readonly<{ matches: MatchSlot[]; bracket: Bracket; teamId: string }>) {
  if (bracket.champion_team_id === teamId) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium">
        <Trophy className="size-4 text-amber-500" aria-hidden="true" />
        Dein Team hat das Turnier gewonnen. Glückwunsch!
      </p>
    );
  }
  const lost = matches.some((s) => s.match.status === "finished" && s.match.winner_team_id !== teamId);
  const text = lost
    ? "Dein Team ist ausgeschieden. Danke fürs Mitspielen!"
    : "Für dein Team sind keine weiteren Spiele eingeplant.";
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

/**
 * What still concerns my team: every match it is placed in that has not been played yet (the next one and
 * the ones that are already fixed after it). Nothing from the past. Same row as the list of all matches.
 */
export function MyMatches({ bracket, teamsMap, teamId, onMatchClick }: Readonly<MyMatchesProps>) {
  const layout = useMemo(() => buildBracketLayout(bracket), [bracket]);
  const mine = useMemo(
    () => allMatchSlots(layout).filter((s) => s.match.team_a_id === teamId || s.match.team_b_id === teamId),
    [layout, teamId],
  );
  const upcoming = mine.filter((s) => s.match.status !== "finished");

  return (
    <div className="space-y-3">
      {upcoming.length === 0 ? (
        <NothingToPlay matches={mine} bracket={bracket} teamId={teamId} />
      ) : (
        <ul className="space-y-3">
          {upcoming.map((slot) => (
            <li key={slot.match.id} className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {roundLabel(slot.match.round, layout.totalRounds)}
              </p>
              <MatchRow slot={slot} teamsMap={teamsMap} highlightTeamId={teamId} onClick={onMatchClick} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
