import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTournamentRole } from './use-tournament-role';
import { TournamentRoleType } from '@/types';
import type { TournamentUserRole, User } from '@/types';

const useCurrentUser = vi.fn();
vi.mock('@/hooks/queries/user', () => ({ useCurrentUser: () => useCurrentUser() }));

const user = (overrides: Partial<User> = {}): User => ({
  id: 'u1',
  phone_number: '+49',
  name: 'Me',
  email: null,
  is_system_admin: false,
  created_at: '',
  ...overrides,
});

const roles = (role: TournamentRoleType): TournamentUserRole[] => [
  { id: 'r1', tournament_id: 't', user_id: 'u1', role, assigned_at: '' },
  { id: 'r2', tournament_id: 't', user_id: 'other', role: TournamentRoleType.ADMIN, assigned_at: '' },
];

const run = (roleList?: TournamentUserRole[]) => renderHook(() => useTournamentRole(roleList)).result.current;

describe('useTournamentRole', () => {
  beforeEach(() => useCurrentUser.mockReset());

  it('has no rights without a user', () => {
    useCurrentUser.mockReturnValue({ user: null });
    expect(run(roles(TournamentRoleType.ADMIN))).toEqual({
      role: null, isAdmin: false, isManager: false, isReferee: false, isSystemAdmin: false,
    });
  });

  it('has no rights without roles but keeps the system admin flag', () => {
    useCurrentUser.mockReturnValue({ user: user({ is_system_admin: true }) });
    expect(run(undefined)).toMatchObject({ role: null, isAdmin: false, isSystemAdmin: true });
  });

  it.each([
    [TournamentRoleType.ADMIN, true, true, true],
    [TournamentRoleType.MANAGER, false, true, true],
    [TournamentRoleType.REFEREE, false, false, true],
  ])('applies the hierarchy for %s', (role, isAdmin, isManager, isReferee) => {
    useCurrentUser.mockReturnValue({ user: user() });
    expect(run(roles(role))).toMatchObject({ role, isAdmin, isManager, isReferee });
  });

  it('has no role when the user is not part of the tournament', () => {
    useCurrentUser.mockReturnValue({ user: user({ id: 'stranger' }) });
    const result = run([roles(TournamentRoleType.MANAGER)[0]]);
    expect(result).toMatchObject({ role: null, isAdmin: false, isManager: false, isReferee: false });
  });

  it('treats system admins as admins everywhere', () => {
    useCurrentUser.mockReturnValue({ user: user({ id: 'stranger', is_system_admin: true }) });
    expect(run([])).toMatchObject({ role: null, isAdmin: true, isManager: true, isReferee: true });
  });
});
