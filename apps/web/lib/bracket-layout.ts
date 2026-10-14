import type { Bracket, Match } from "@/types";

/**
 * Turns the flat match list of the API into the grid the bracket is drawn on:
 * per round one slot for every position of a full bracket, so a match always sits
 * in the middle of the two slots that feed it.
 */

export interface MatchSlot {
  kind: "match";
  match: Match;
  /** Running number over all matches ("Spiel 12"), ordered by round and position. */
  number: number;
  /** Numbers of the matches whose winners play in slot a / slot b (null: no feeder match, e.g. a bye). */
  sources: { a: number | null; b: number | null };
}

/** A team that skips round one: no match, it is entered directly into round two. */
export interface ByeSlot {
  kind: "bye";
  teamId: string;
}

export interface EmptySlot {
  kind: "empty";
}

export type BracketSlot = MatchSlot | ByeSlot | EmptySlot;

export interface RoundLayout {
  round: number;
  slots: BracketSlot[];
  matchCount: number;
  finishedCount: number;
}

export interface BracketLayout {
  totalRounds: number;
  rounds: RoundLayout[];
}

export function buildBracketLayout(bracket: Bracket): BracketLayout {
  const total = bracket.total_rounds;
  const matches = bracket.matches
    .filter((m) => m.round >= 1 && m.round <= total)
    .sort((a, b) => a.round - b.round || a.position - b.position);

  const numberById = new Map(matches.map((m, i) => [m.id, i + 1]));
  const byPosition = new Map(matches.map((m) => [`${m.round}:${m.position}`, m]));

  // number of the match feeding slot "a" / "b" of a parent match
  const feeder = new Map<string, number>();
  for (const m of matches) {
    if (m.next_match_id && m.next_match_slot) {
      feeder.set(`${m.next_match_id}:${m.next_match_slot}`, numberById.get(m.id)!);
    }
  }

  const rounds: RoundLayout[] = [];
  for (let round = 1; round <= total; round++) {
    const size = 2 ** (total - round);
    const slots: BracketSlot[] = [];
    for (let position = 0; position < size; position++) {
      const match = byPosition.get(`${round}:${position}`);
      if (match) {
        slots.push({
          kind: "match",
          match,
          number: numberById.get(match.id)!,
          sources: {
            a: feeder.get(`${match.id}:a`) ?? null,
            b: feeder.get(`${match.id}:b`) ?? null,
          },
        });
        continue;
      }
      // No match at this position of round one: the team was entered straight into round two.
      const parent = round === 1 ? byPosition.get(`2:${position >> 1}`) : undefined;
      const teamId = parent ? (position % 2 === 0 ? parent.team_a_id : parent.team_b_id) : null;
      slots.push(teamId ? { kind: "bye", teamId } : { kind: "empty" });
    }

    const roundMatches = matches.filter((m) => m.round === round);
    rounds.push({
      round,
      slots,
      matchCount: roundMatches.length,
      finishedCount: roundMatches.filter((m) => m.status === "finished").length,
    });
  }
  return { totalRounds: total, rounds };
}

/** A slot whose team has already moved on: a finished match or a bye. */
export function isAdvanced(slot: BracketSlot | undefined): boolean {
  return slot?.kind === "bye" || (slot?.kind === "match" && slot.match.status === "finished");
}

/** The round that is being played right now: the first one with a match that is ready. */
export function currentRound(layout: BracketLayout): number | null {
  const round = layout.rounds.find((r) => r.slots.some((s) => s.kind === "match" && s.match.status === "ready"));
  return round ? round.round : null;
}

/**
 * First round worth showing: the earliest one that is not completely played.
 * A finished tournament shows the last two rounds.
 */
export function defaultFirstRound(layout: BracketLayout): number {
  const open = layout.rounds.find((r) => r.finishedCount < r.matchCount);
  if (open) return open.round;
  return Math.max(1, layout.totalRounds - 1);
}
