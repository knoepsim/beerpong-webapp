import { describe, expect, it } from 'vitest'
import { buildBracketLayout, buildGroupLayouts, matchSlotsOf } from './bracket-layout'
import { describeSides } from './match-display'
import { moveWithinRank, openTies } from './groups'
import { statusInBracket } from './my-status'
import { groupsBracket } from './test-fixtures/bracket'
import { makeTournamentTeam } from './test-fixtures/tournament'
import { GAMES } from '@/components/games'
import { Game, type Team } from '@/types'

const TABLES = GAMES[Game.BEERPONG].station
const teams = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((id) => [id, { id, name: id.toUpperCase() } as Team]))

describe('group stage and knock-out', () => {
  it('numbers the group matches first (day by day), then the tree', () => {
    const bracket = groupsBracket()
    expect(matchSlotsOf(bracket).map((s) => [s.match.id, s.number])).toEqual([['g1', 1], ['g2', 2], ['g3', 3], ['k1', 4]])
    const [a] = buildGroupLayouts(bracket)
    expect(a.layout.kind).toBe('days')
    expect(a.layout.rounds.map((r) => r.slots.map((s) => s.kind === 'match' && s.match.id))).toEqual([['g1'], ['g3']])
    expect(buildBracketLayout(bracket).kind).toBe('tree')
  })

  it('names the places of the tree until the knock-out starts', () => {
    const [slot] = buildBracketLayout(groupsBracket()).rounds[0].slots
    if (slot.kind !== 'match') throw new Error('expected a match')
    expect(describeSides(slot, teams).map((side) => side.placeholder)).toEqual(['1. Gruppe A', '1. Gruppe B'])
  })

  it('finds the ties that matter and moves teams only past an equal one', () => {
    const [a, b] = groupsBracket().groups!
    expect(openTies(a.standings, 1)).toEqual([])
    expect(openTies(a.standings, 2)).toEqual([['b', 'c']])
    expect(openTies(b.standings, 1)).toEqual([['d', 'e']])
    expect(moveWithinRank(['a', 'b', 'c'], a.standings, 'c', -1)).toEqual(['a', 'c', 'b'])
    expect(moveWithinRank(['a', 'b', 'c'], a.standings, 'b', -1)).toEqual(['a', 'b', 'c']) // not past a better team
  })

  it('says where I stand after my group matches, and that I am out once the knock-out runs without me', () => {
    const played = groupsBracket({
      matches: groupsBracket().matches.map((m) => (m.group === 1 ? { ...m, status: 'finished' as const, winner_team_id: m.team_a_id } : m)),
    })
    const c = makeTournamentTeam({ id: 'c', name: 'C' })
    const slots = matchSlotsOf(played)
    expect(statusInBracket(slots, played, c, teams, TABLES)?.title).toBe('Deine Gruppenspiele sind gespielt: Platz 2 in Gruppe A.')
    expect(statusInBracket(slots, { ...played, knockout_started: true }, c, teams, TABLES)?.title).toBe(
      'Du bist in der Gruppenphase ausgeschieden: Platz 2 in Gruppe A mit C.',
    )
  })
})
