import { useCurrentUser } from "@/components/user-provider";
import type { TournamentUserRole } from "@/types";

export function useTournamentRole(roles?: TournamentUserRole[]) {
  const { user } = useCurrentUser();

  if (!user || !roles) {
    return {
      role: null,
      isAdmin: false,
      isManager: false,
      isReferee: false,
      isSystemAdmin: user?.is_system_admin ?? false,
    };
  }

  // Find the role for the current user
  const userRole = roles.find((r) => r.user_id === user.id)?.role;

  // Role hierarchy
  // ADMIN > MANAGER > REFEREE
  const isAdmin = userRole === "admin" || user.is_system_admin;
  const isManager = isAdmin || userRole === "manager";
  const isReferee = isManager || userRole === "referee";

  return {
    role: userRole || null,
    isAdmin,
    isManager,
    isReferee,
    isSystemAdmin: user.is_system_admin,
  };
}
