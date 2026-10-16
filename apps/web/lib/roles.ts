import { TournamentRoleType, type TournamentUserRole } from "@/types";

/** Strongest first: an admin can do everything a manager can, a manager everything a referee can. */
const RANK: TournamentRoleType[] = [TournamentRoleType.ADMIN, TournamentRoleType.MANAGER, TournamentRoleType.REFEREE];

/** The strongest role of a user in a tournament (a user can hold several), or null without one. */
export function highestRole(roles: TournamentUserRole[], userId: string | undefined): TournamentRoleType | null {
  if (!userId) return null;
  const mine = new Set(roles.filter((r) => r.user_id === userId).map((r) => r.role));
  return RANK.find((role) => mine.has(role)) ?? null;
}
