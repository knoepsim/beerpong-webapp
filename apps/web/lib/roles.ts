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

/** What a role is called and what it may do, in the words of the app. */
export const ROLE_INFO: Record<TournamentRoleType, { label: string; description: string }> = {
  [TournamentRoleType.REFEREE]: { label: "Schiedsrichter", description: "Startet Spiele und trägt Ergebnisse ein." },
  [TournamentRoleType.MANAGER]: {
    label: "Manager",
    description: "Verwaltet das Turnier: Einstellungen, Tische, Einladungen, Start. Vergibt Schiedsrichter.",
  },
  [TournamentRoleType.ADMIN]: {
    label: "Admin",
    description: "Darf alles, auch Manager und Admins ernennen und das Turnier löschen.",
  },
};

/** The roles somebody may give (the same rules as the API): admins all, managers only referees. */
export function assignableRoles(own: TournamentRoleType | null): TournamentRoleType[] {
  if (own === TournamentRoleType.ADMIN) return [TournamentRoleType.REFEREE, TournamentRoleType.MANAGER, TournamentRoleType.ADMIN];
  if (own === TournamentRoleType.MANAGER) return [TournamentRoleType.REFEREE];
  return [];
}

/** Whether somebody may take this role away: admins every role, managers only referees. */
export const mayRevoke = (own: TournamentRoleType | null, role: TournamentRoleType) =>
  assignableRoles(own).includes(role);
