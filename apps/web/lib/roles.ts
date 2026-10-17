import { TournamentRoleType, type TournamentUserRole } from "@/types";

/** Strongest first: an admin can do everything a manager can, a manager everything a referee can. */
const RANK: TournamentRoleType[] = [TournamentRoleType.ADMIN, TournamentRoleType.MANAGER, TournamentRoleType.REFEREE];

/** The strongest of some roles, or null without one. */
export function strongestRole(roles: Iterable<TournamentRoleType>): TournamentRoleType | null {
  const held = new Set(roles);
  return RANK.find((role) => held.has(role)) ?? null;
}

/** The strongest role of a user in a tournament (a user can hold several), or null without one. */
export function highestRole(roles: TournamentUserRole[], userId: string | undefined): TournamentRoleType | null {
  if (!userId) return null;
  return strongestRole(roles.filter((r) => r.user_id === userId).map((r) => r.role));
}
