import { describe, expect, it } from 'vitest'
import { groupTournaments, mergeMyTournaments, type MyTournament } from './tournament-groups'
import type { MyTournamentsResponse, Team, Tournament } from '@/types'
import { TournamentRoleType } from '@/types'

const tournament = (id: string, overrides: Partial<Tournament> = {}): Tournament =>
  ({
    id,
    name: id,
    start_time: '2026-07-01T18:00:00Z',
    created_at: '2026-01-01T10:00:00Z',
    started_at: null,
    finished_at: null,
    ...overrides,
  }) as Tournament

const item = (id: string, overrides: Partial<Tournament> = {}): MyTournament => ({ tournament: tournament(id, overrides) })
const ids = (items: MyTournament[]) => items.map((i) => i.tournament.id)

describe('groupTournaments', () => {
  it('sorts into running, planned and finished', () => {
    const groups = groupTournaments([
      item('planned'),
      item('running', { started_at: '2026-07-01T18:05:00Z' }),
      item('done', { started_at: '2026-06-01T18:05:00Z', finished_at: '2026-06-01T22:00:00Z' }),
    ])
    expect(ids(groups.active)).toEqual(['running'])
    expect(ids(groups.planned)).toEqual(['planned'])
    expect(ids(groups.finished)).toEqual(['done'])
  })

  it('has empty groups when there is nothing, so no heading is needed', () => {
    expect(groupTournaments([])).toEqual({ active: [], planned: [], finished: [] })
    const onlyPlanned = groupTournaments([item('p')])
    expect(onlyPlanned.active).toHaveLength(0)
    expect(onlyPlanned.finished).toHaveLength(0)
  })

  it('shows the soonest planned tournament first, falling back to the creation date', () => {
    const groups = groupTournaments([
      item('later', { start_time: '2026-09-01T18:00:00Z' }),
      item('sooner', { start_time: '2026-08-01T18:00:00Z' }),
      item('no-date', { start_time: null, created_at: '2026-01-05T10:00:00Z' }),
    ])
    expect(ids(groups.planned)).toEqual(['no-date', 'sooner', 'later'])
  })

  it('shows the latest started running and the latest finished tournament first', () => {
    const groups = groupTournaments([
      item('a', { started_at: '2026-07-01T10:00:00Z' }),
      item('b', { started_at: '2026-07-02T10:00:00Z' }),
      item('old', { started_at: '2026-05-01T10:00:00Z', finished_at: '2026-05-01T20:00:00Z' }),
      item('new', { started_at: '2026-06-01T10:00:00Z', finished_at: '2026-06-01T20:00:00Z' }),
    ])
    expect(ids(groups.active)).toEqual(['b', 'a'])
    expect(ids(groups.finished)).toEqual(['new', 'old'])
  })

  it('does not count a tournament twice', () => {
    const groups = groupTournaments([item('x', { started_at: '2026-07-01T10:00:00Z', finished_at: '2026-07-01T20:00:00Z' })])
    expect(groups.active).toHaveLength(0)
    expect(groups.finished).toHaveLength(1)
  })
})

describe('mergeMyTournaments', () => {
  const team = { id: 'team', name: 'Team' } as Team

  it('merges a tournament I play in and manage into one entry', () => {
    const t = tournament('t')
    const data = {
      participating: [{ tournament: t, team }],
      managing: [{ tournament: t, role: TournamentRoleType.ADMIN }],
    } as MyTournamentsResponse

    const merged = mergeMyTournaments(data)

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ team, role: TournamentRoleType.ADMIN })
  })

  it('keeps tournaments with only a team or only a role', () => {
    const data = {
      participating: [{ tournament: tournament('p'), team }],
      managing: [{ tournament: tournament('m'), role: TournamentRoleType.REFEREE }],
    } as MyTournamentsResponse

    const merged = mergeMyTournaments(data)

    expect(merged.map((i) => [i.tournament.id, !!i.team, i.role])).toEqual([
      ['p', true, undefined],
      ['m', false, TournamentRoleType.REFEREE],
    ])
  })
})
