import type { Standing } from "@/types";

/** 1 -> "A", 2 -> "B", … */
export const groupLetter = (group: number) => String.fromCodePoint(64 + group);

/**
 * Teams of a group that share a rank where it matters: whether they go on, or at which place (the same rule as the
 * API, app/services/groups.py). The organization decides their order before the knock-out starts.
 */
export function openTies(standings: Standing[], advance: number): string[][] {
  const blocks = new Map<number, string[]>();
  for (const row of standings) blocks.set(row.rank, [...(blocks.get(row.rank) ?? []), row.team_id]);
  return [...blocks.entries()].filter(([rank, teams]) => teams.length > 1 && rank <= advance).map(([, teams]) => teams);
}

/** Move a team one place up (-1) or down (+1), only past a team of the same rank. */
export function moveWithinRank(order: string[], standings: Standing[], teamId: string, step: -1 | 1): string[] {
  const rank = new Map(standings.map((row) => [row.team_id, row.rank]));
  const i = order.indexOf(teamId);
  const j = i + step;
  if (i < 0 || j < 0 || j >= order.length || rank.get(order[j]) !== rank.get(teamId)) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
