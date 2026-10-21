import type { MatchSlot } from "@/lib/bracket-layout";
import { TournamentMode, type Bracket, type Match, type Team } from "@/types";

/** Shorthand for a match with the defaults of an untouched, waiting match. */
export const makeMatch = (overrides: Partial<Match> & Pick<Match, "id" | "round" | "position">): Match => ({
  tournament_id: "t",
  team_a_id: null,
  team_b_id: null,
  next_match_id: null,
  next_match_slot: null,
  group: null,
  source_a: null,
  source_b: null,
  station_id: null,
  station_name: null,
  queue_position: null,
  upcoming_station_id: null,
  upcoming_station_name: null,
  on_station_at: null,
  started_at: null,
  created_at: "",
  status: "waiting",
  winner_team_id: null,
  score_a: null,
  score_b: null,
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
    mode: TournamentMode.SINGLE_ELIMINATION,
    standings: null,
    groups: null,
    knockout_started: false,
    total_rounds: 3,
    champion_team_id: null,
    matches: [
      makeMatch({
        id: "m1", round: 1, position: 1, team_a_id: "t4", team_b_id: "t5",
        next_match_id: "m2", next_match_slot: "b", status: "ready",
        station_id: "x1", station_name: "Tisch 1", ...overrides.m1,
      }),
      makeMatch({
        id: "m2", round: 2, position: 0, team_a_id: "t1", team_b_id: null,
        next_match_id: "m4", next_match_slot: "a", ...overrides.m2,
      }),
      makeMatch({
        id: "m3", round: 2, position: 1, team_a_id: "t2", team_b_id: "t3",
        next_match_id: "m4", next_match_slot: "b", status: "ready",
        station_id: "x2", station_name: "Tisch 2", ...overrides.m3,
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
    station_id: "x1", station_name: "Tisch 1", ...overrides }),
});

/**
 * Everybody against everybody with three teams a, b, c (three match days, one break each): a beat b, the other two
 * matches are open unless overridden.
 */
export function roundRobinBracket(overrides: Partial<Bracket> = {}): Bracket {
  const m = (id: string, round: number, a: string, b: string, more: Partial<Match> = {}) =>
    makeMatch({ id, round, position: 0, team_a_id: a, team_b_id: b, status: "queued", ...more });
  return {
    tournament_id: "t",
    mode: TournamentMode.ROUND_ROBIN,
    groups: null,
    knockout_started: false,
    total_rounds: 3,
    champion_team_id: null,
    matches: [
      m("d1", 1, "a", "b", { status: "finished", winner_team_id: "a", score_a: 3, score_b: 0 }),
      m("d2", 2, "b", "c"),
      m("d3", 3, "c", "a"),
    ],
    standings: [
      { team_id: "a", rank: 1, played: 1, won: 1, drawn: 0, lost: 0, score_for: 3, score_against: 0, points: 3 },
      { team_id: "c", rank: 2, played: 0, won: 0, drawn: 0, lost: 0, score_for: 0, score_against: 0, points: 0 },
      { team_id: "b", rank: 3, played: 1, won: 0, drawn: 0, lost: 1, score_for: 0, score_against: 3, points: 0 },
    ],
    ...overrides,
  };
}

export const abcTeams: Record<string, Team> = {
  ...abTeams,
  c: { id: "c", name: "Charlie" } as Team,
};

/**
 * Group stage and knock-out: group A (a, b, c: a beat b) and group B (d, e: open), two of each go on into a final
 * of "A1" against "B1" … here one knock-out match of A1 against B1 to keep it small.
 */
export function groupsBracket(overrides: Partial<Bracket> = {}): Bracket {
  const m = (id: string, round: number, position: number, group: number | null, more: Partial<Match> = {}) =>
    makeMatch({ id, round, position, group, status: "queued", ...more });
  const row = (team_id: string, rank: number, points = 0) => ({
    team_id, rank, played: 0, won: 0, drawn: 0, lost: 0, score_for: 0, score_against: 0, points,
  });
  return {
    tournament_id: "t",
    mode: TournamentMode.GROUPS_KNOCKOUT,
    total_rounds: 1,
    champion_team_id: null,
    standings: null,
    knockout_started: false,
    groups: [
      { group: 1, standings: [row("a", 1, 3), row("b", 2), row("c", 2)] },
      { group: 2, standings: [row("d", 1), row("e", 1)] },
    ],
    matches: [
      m("g1", 1, 0, 1, { team_a_id: "a", team_b_id: "b", status: "finished", winner_team_id: "a", score_a: 3, score_b: 0 }),
      m("g2", 1, 1, 2, { team_a_id: "d", team_b_id: "e" }),
      m("g3", 2, 0, 1, { team_a_id: "b", team_b_id: "c" }),
      m("k1", 1, 0, null, { status: "waiting", source_a: "A1", source_b: "B1" }),
    ],
    ...overrides,
  };
}
