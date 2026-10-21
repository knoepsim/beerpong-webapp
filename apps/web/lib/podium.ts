import type { Bracket, Match } from "@/types";

export interface Podium {
  champion: string;
  /** The loser of the final. */
  runnerUp: string | null;
  /** The losers of the semi-finals: in a knock-out they share third place. */
  third: string[];
}

function loser(match: Match): string | null {
  if (match.status !== "finished" || !match.winner_team_id) return null;
  return match.team_a_id === match.winner_team_id ? match.team_b_id : match.team_a_id;
}

/**
 * The places at the end: in a knock-out the winner, the runner-up and the two shared third places; where everybody
 * plays everybody the first three of the table. null before the end.
 */
export function podium(bracket: Bracket): Podium | null {
  if (!bracket.champion_team_id) return null;
  if (bracket.standings) {
    const at = (rank: number) => bracket.standings!.filter((row) => row.rank === rank).map((row) => row.team_id);
    return { champion: bracket.champion_team_id, runnerUp: at(2)[0] ?? null, third: at(3) };
  }
  const tree = bracket.matches.filter((m) => m.group === null);
  const final = tree.find((m) => m.round === bracket.total_rounds);
  const semis = tree.filter((m) => m.round === bracket.total_rounds - 1);
  return {
    champion: bracket.champion_team_id,
    runnerUp: final ? loser(final) : null,
    third: semis.map(loser).filter((id): id is string => id !== null),
  };
}
