import { isOpen } from "@/lib/match-display";
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
}

export interface BracketLayout {
  totalRounds: number;
  rounds: RoundLayout[];
}

/** Matches inside the rounds of the bracket in the order of their numbers. */
function orderedMatches(bracket: Bracket): Match[] {
  return bracket.matches
    .filter((m) => m.round >= 1 && m.round <= bracket.total_rounds)
    .sort((a, b) => a.round - b.round || a.position - b.position);
}

/**
 * The team that was entered straight into round two at an empty position of round one, if any:
 * even positions play in slot a of the match of the next round, odd positions in slot b.
 */
function byeTeamId(parent: Match | undefined, position: number): string | null {
  if (!parent) return null;
  return position % 2 === 0 ? parent.team_a_id : parent.team_b_id;
}

export function buildBracketLayout(bracket: Bracket): BracketLayout {
  const total = bracket.total_rounds;
  const matches = orderedMatches(bracket);

  const numberOf = new Map(matches.map((m, i) => [m.id, i + 1]));
  const byPosition = new Map(matches.map((m) => [`${m.round}:${m.position}`, m]));

  // number of the match feeding slot "a" / "b" of a parent match
  const feeder = new Map<string, number>();
  for (const m of matches) {
    if (m.next_match_id && m.next_match_slot) {
      feeder.set(`${m.next_match_id}:${m.next_match_slot}`, numberOf.get(m.id)!);
    }
  }

  const slotAt = (round: number, position: number): BracketSlot => {
    const match = byPosition.get(`${round}:${position}`);
    if (match) {
      return {
        kind: "match",
        match,
        number: numberOf.get(match.id)!,
        sources: { a: feeder.get(`${match.id}:a`) ?? null, b: feeder.get(`${match.id}:b`) ?? null },
      };
    }
    // No match at this position of round one: the team was entered straight into round two.
    const parent = round === 1 ? byPosition.get(`2:${position >> 1}`) : undefined;
    const teamId = byeTeamId(parent, position);
    return teamId ? { kind: "bye", teamId } : { kind: "empty" };
  };

  const rounds: RoundLayout[] = Array.from({ length: total }, (_, index) => {
    const round = index + 1;
    return {
      round,
      slots: Array.from({ length: 2 ** (total - round) }, (_, position) => slotAt(round, position)),
    };
  });
  return { totalRounds: total, rounds };
}

/** A slot whose team has already moved on: a finished match or a bye. */
export function isAdvanced(slot: BracketSlot | undefined): boolean {
  return slot?.kind === "bye" || (slot?.kind === "match" && slot.match.status === "finished");
}

/** The rounds with a match that can be played right now. Several rounds can be active at the same time. */
export function activeRounds(layout: BracketLayout): Set<number> {
  const active = layout.rounds.filter((r) => r.slots.some((s) => s.kind === "match" && isOpen(s.match)));
  return new Set(active.map((r) => r.round));
}

export function isMatchSlot(slot: BracketSlot): slot is MatchSlot {
  return slot.kind === "match";
}

/** All matches in the order of their numbers (round by round), without byes. */
export function allMatchSlots(layout: BracketLayout): MatchSlot[] {
  return layout.rounds.flatMap((r) => r.slots.filter(isMatchSlot));
}
