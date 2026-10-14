import { describe, expect, it } from 'vitest'
import { buildBracketLayout, defaultFirstRound } from './bracket-layout'
import { fiveTeamBracket, makeMatch } from './test-fixtures/bracket'
import type { Bracket } from '@/types'

describe('buildBracketLayout', () => {
  const layout = buildBracketLayout(fiveTeamBracket())

  it('has one slot per position of a full bracket in every round', () => {
    expect(layout.totalRounds).toBe(3)
    expect(layout.rounds.map((r) => r.slots.length)).toEqual([4, 2, 1])
  })

  it('turns round-one positions without a match into byes with the team of the next round', () => {
    expect(layout.rounds[0].slots.map((s) => s.kind)).toEqual(['bye', 'match', 'bye', 'bye'])
    const byes = layout.rounds[0].slots.flatMap((s) => (s.kind === 'bye' ? [s.teamId] : []))
    expect(byes).toEqual(['t1', 't2', 't3'])
  })

  it('numbers the matches by round and position', () => {
    const numbers = layout.rounds.flatMap((r) => r.slots.flatMap((s) => (s.kind === 'match' ? [s.number] : [])))
    expect(numbers).toEqual([1, 2, 3, 4])
  })

  it('knows which match feeds which slot, and leaves byes without a source', () => {
    const [semiA, semiB] = layout.rounds[1].slots
    expect(semiA).toMatchObject({ kind: 'match', sources: { a: null, b: 1 } }) // T1 came from a bye
    expect(semiB).toMatchObject({ kind: 'match', sources: { a: null, b: null } }) // two byes meet
    expect(layout.rounds[2].slots[0]).toMatchObject({ sources: { a: 2, b: 3 } })
  })

  it('counts matches and finished matches per round', () => {
    const played = buildBracketLayout(fiveTeamBracket({ m1: { status: 'finished', winner_team_id: 't4' } }))
    expect(played.rounds.map((r) => [r.matchCount, r.finishedCount])).toEqual([[1, 1], [2, 0], [1, 0]])
  })

  it('ignores matches outside the rounds of the bracket', () => {
    const odd: Bracket = {
      ...fiveTeamBracket(),
      matches: [...fiveTeamBracket().matches, makeMatch({ id: 'x', round: 9, position: 0 })],
    }
    expect(buildBracketLayout(odd).rounds.flatMap((r) => r.slots).length).toBe(7)
  })

  it('is empty without rounds', () => {
    expect(buildBracketLayout({ tournament_id: 't', total_rounds: 0, champion_team_id: null, matches: [] }).rounds).toEqual([])
  })
})

describe('defaultFirstRound', () => {
  const finished = { status: 'finished' as const, winner_team_id: 't1' }

  it('starts with the first round of a fresh bracket', () => {
    expect(defaultFirstRound(buildBracketLayout(fiveTeamBracket()))).toBe(1)
  })

  it('skips rounds that are completely played', () => {
    expect(defaultFirstRound(buildBracketLayout(fiveTeamBracket({ m1: finished })))).toBe(2)
    expect(defaultFirstRound(buildBracketLayout(fiveTeamBracket({ m1: finished, m2: finished })))).toBe(2)
    expect(defaultFirstRound(buildBracketLayout(fiveTeamBracket({ m1: finished, m2: finished, m3: finished })))).toBe(3)
  })

  it('shows the last two rounds of a finished tournament', () => {
    const all = fiveTeamBracket({ m1: finished, m2: finished, m3: finished, m4: finished })
    expect(defaultFirstRound(buildBracketLayout(all))).toBe(2)
  })

  it('never goes below round one', () => {
    const single: Bracket = {
      tournament_id: 't', total_rounds: 1, champion_team_id: 't1',
      matches: [makeMatch({ id: 'f', round: 1, position: 0, team_a_id: 't1', team_b_id: 't2', ...finished })],
    }
    expect(defaultFirstRound(buildBracketLayout(single))).toBe(1)
  })
})
