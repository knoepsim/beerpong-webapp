import { describe, expect, it } from 'vitest'
import { phaseLabel, planStart } from './tournament-phase'
import type { TournamentTeam } from '@/types'

const team = (id: string, checkedIn: boolean): TournamentTeam =>
  ({ id, name: `Team ${id}`, is_checked_in: checkedIn }) as TournamentTeam

describe('phaseLabel', () => {
  it('names every phase', () => {
    expect(phaseLabel('registration')).toBe('Anmeldung offen')
    expect(phaseLabel('registration_closed')).toBe('Anmeldung geschlossen')
    expect(phaseLabel('checkin')).toBe('Check-in läuft')
    expect(phaseLabel('running')).toBe('Läuft')
    expect(phaseLabel('finished')).toBe('Beendet')
  })
})

describe('planStart', () => {
  const teams = [team('A', true), team('B', false), team('C', true)]

  it('lets everybody play without check-in', () => {
    const plan = planStart({ checkin_enabled: false }, teams)
    expect(plan.playing).toHaveLength(3)
    expect(plan.removed).toHaveLength(0)
    expect(plan.canStart).toBe(true)
    expect(plan.description).toContain('3 Teams spielen mit')
  })

  it('names the teams that are removed because they did not check in', () => {
    const plan = planStart({ checkin_enabled: true }, teams)
    expect(plan.playing.map((t) => t.id)).toEqual(['A', 'C'])
    expect(plan.removed.map((t) => t.id)).toEqual(['B'])
    expect(plan.description).toContain('Team B')
    expect(plan.description).toContain('entfernt')
  })

  it('does not mention removals when everybody is checked in', () => {
    const plan = planStart({ checkin_enabled: true }, [team('A', true), team('B', true)])
    expect(plan.description).not.toContain('entfernt')
  })

  it('cannot start with fewer than two playing teams and says why', () => {
    const checkin = planStart({ checkin_enabled: true }, [team('A', true), team('B', false)])
    expect(checkin.canStart).toBe(false)
    expect(checkin.description).toContain('eingecheckt')

    const plain = planStart({ checkin_enabled: false }, [team('A', false)])
    expect(plain.canStart).toBe(false)
    expect(plain.description).toContain('angemeldet')
  })
})
