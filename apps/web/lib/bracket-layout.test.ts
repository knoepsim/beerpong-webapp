import { describe, expect, it } from 'vitest'
import { activeRounds, allMatchSlots, buildBracketLayout, focusRound, isAdvanced, isMatchSlot } from './bracket-layout'
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

  it('ignores matches outside the rounds of the bracket', () => {
    const odd: Bracket = {
      ...fiveTeamBracket(),
      matches: [...fiveTeamBracket().matches, makeMatch({ id: 'x', round: 9, position: 0 })],
    }
    expect(buildBracketLayout(odd).rounds.flatMap((r) => r.slots)).toHaveLength(7)
  })

  it('is empty without rounds', () => {
    expect(buildBracketLayout({ tournament_id: 't', total_rounds: 0, champion_team_id: null, matches: [] }).rounds).toEqual([])
  })
})

describe('isAdvanced', () => {
  const layout = (overrides = {}) => buildBracketLayout(fiveTeamBracket(overrides)).rounds[0].slots

  it('is true for byes and finished matches only', () => {
    const [bye, match] = layout()
    expect(isAdvanced(bye)).toBe(true)
    expect(isAdvanced(match)).toBe(false) // ready, not played
    expect(isAdvanced(layout({ m1: { status: 'finished', winner_team_id: 't4' } })[1])).toBe(true)
    expect(isAdvanced(undefined)).toBe(false)
  })
})

describe('activeRounds', () => {
  it('lists the rounds with a match that can be played, also several at once', () => {
    expect([...activeRounds(buildBracketLayout(fiveTeamBracket()))]).toEqual([1, 2]) // match 1 and the ready semi-final
    const played = fiveTeamBracket({ m1: { status: 'finished', winner_team_id: 't4' } })
    expect([...activeRounds(buildBracketLayout(played))]).toEqual([2])
  })

  it('is empty when nothing can be played', () => {
    const done = fiveTeamBracket({
      m1: { status: 'finished', winner_team_id: 't4' },
      m3: { status: 'finished', winner_team_id: 't2' },
    })
    done.matches[1].status = 'finished'
    done.matches[3].status = 'finished'
    expect(activeRounds(buildBracketLayout(done)).size).toBe(0)
  })
})

describe('allMatchSlots', () => {
  const layout = buildBracketLayout(fiveTeamBracket())

  it('lists the matches in the order of their numbers and leaves the byes out', () => {
    const slots = allMatchSlots(layout)
    expect(slots.map((s) => s.number)).toEqual([1, 2, 3, 4])
    expect(slots.map((s) => s.match.id)).toEqual(['m1', 'm2', 'm3', 'm4'])
  })

  it('tells match slots from byes', () => {
    const [bye, match] = layout.rounds[0].slots
    expect(isMatchSlot(bye)).toBe(false)
    expect(isMatchSlot(match)).toBe(true)
  })
})

describe('focusRound', () => {
  const layout = (overrides = {}) => buildBracketLayout(fiveTeamBracket(overrides))

  it('opens at the round of my next match', () => {
    expect(focusRound(layout(), 't1')).toBe(2) // T1 waits in the semi-final
    expect(focusRound(layout(), 't4')).toBe(1)
  })

  it('opens at the first round with something to play without a team of mine', () => {
    expect(focusRound(layout(), null)).toBe(1)
    expect(focusRound(layout({ m1: { status: 'finished', winner_team_id: 't4' } }), 'nobody')).toBe(2)
  })

  it('opens at the final when everything is played', () => {
    const done = { status: 'finished' as const, winner_team_id: 'x' }
    expect(focusRound(layout({ m1: done, m2: done, m3: done, m4: done }))).toBe(3)
  })
})
