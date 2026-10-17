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

/** The places of a finished knock-out: winner, runner-up and the two shared third places; null before the end. */
export function podium(bracket: Bracket): Podium | null {
  if (!bracket.champion_team_id) return null;
  const final = bracket.matches.find((m) => m.round === bracket.total_rounds);
  const semis = bracket.matches.filter((m) => m.round === bracket.total_rounds - 1);
  return {
    champion: bracket.champion_team_id,
    runnerUp: final ? loser(final) : null,
    third: semis.map(loser).filter((id): id is string => id !== null),
  };
}
