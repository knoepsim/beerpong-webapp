import { describe, expect, it } from 'vitest'
import { highestRole } from './roles'
import { TournamentRoleType, type TournamentUserRole } from '@/types'

const role = (user_id: string, r: TournamentRoleType) => ({ id: `${user_id}-${r}`, user_id, role: r }) as TournamentUserRole

describe('highestRole', () => {
  it('takes the strongest of several roles, whatever their order', () => {
    const roles = [role('u', TournamentRoleType.REFEREE), role('u', TournamentRoleType.ADMIN)]
    expect(highestRole(roles, 'u')).toBe(TournamentRoleType.ADMIN)
  })

  it('ignores the roles of others and is null without a role or user', () => {
    const roles = [role('other', TournamentRoleType.ADMIN), role('u', TournamentRoleType.REFEREE)]
    expect(highestRole(roles, 'u')).toBe(TournamentRoleType.REFEREE)
    expect(highestRole(roles, 'nobody')).toBeNull()
    expect(highestRole(roles, undefined)).toBeNull()
  })
})
