import type { MatchSlot } from "@/lib/bracket-layout";
import type { Bracket, Match, Team } from "@/types";

/** Shorthand for a match with the defaults of an untouched, waiting match. */
export const makeMatch = (overrides: Partial<Match> & Pick<Match, "id" | "round" | "position">): Match => ({
  tournament_id: "t",
  team_a_id: null,
  team_b_id: null,
  next_match_id: null,
  next_match_slot: null,
  table_id: null,
  table_name: null,
  queue_position: null,
  upcoming_table_id: null,
  upcoming_table_name: null,
  started_at: null,
  created_at: "",
  status: "waiting",
  winner_team_id: null,
  cups_left: null,
  ...overrides,
});

export const fiveTeams: Record<string, Team> = Object.fromEntries(
  [1, 2, 3, 4, 5].map((n) => [`t${n}`, { id: `t${n}`, name: `Team ${n}` } as Team]),
);

/**
 * Bracket of 5 teams as the API builds it (8 slots, 3 byes):
 *   round 1: bye T1 | match T4-T5 | bye T2 | bye T3
 *   round 2: T1 vs winner of match 1 | T2 vs T3
 *   round 3: final
 */
export function fiveTeamBracket(overrides: Partial<Record<"m1" | "m2" | "m3" | "m4", Partial<Match>>> = {}): Bracket {
  return {
    tournament_id: "t",
    total_rounds: 3,
    champion_team_id: null,
    matches: [
      makeMatch({
        id: "m1", round: 1, position: 1, team_a_id: "t4", team_b_id: "t5",
        next_match_id: "m2", next_match_slot: "b", status: "ready",
        table_id: "x1", table_name: "Tisch 1", ...overrides.m1,
      }),
      makeMatch({
        id: "m2", round: 2, position: 0, team_a_id: "t1", team_b_id: null,
        next_match_id: "m4", next_match_slot: "a", ...overrides.m2,
      }),
      makeMatch({
        id: "m3", round: 2, position: 1, team_a_id: "t2", team_b_id: "t3",
        next_match_id: "m4", next_match_slot: "b", status: "ready",
        table_id: "x2", table_name: "Tisch 2", ...overrides.m3,
      }),
      makeMatch({ id: "m4", round: 3, position: 0, ...overrides.m4 }),
    ],
  };
}

export const abTeams: Record<string, Team> = {
  a: { id: "a", name: "Alpha" } as Team,
  b: { id: "b", name: "Bravo" } as Team,
};

/** A match slot of team a against team b (number 7), ready at "Tisch 1" unless overridden. */
export const makeSlot = (overrides: Partial<Match> = {}, sources: MatchSlot["sources"] = { a: null, b: null }): MatchSlot => ({
  kind: "match",
  number: 7,
  sources,
  match: makeMatch({ id: "m", round: 1, position: 0, team_a_id: "a", team_b_id: "b", status: "ready",
    table_id: "x1", table_name: "Tisch 1", ...overrides }),
});
