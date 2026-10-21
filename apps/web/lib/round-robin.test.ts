import { describe, expect, it } from 'vitest'
import { allMatchSlots, buildBracketLayout, roundTitle } from './bracket-layout'
import { describeSides, matchSummary } from './match-display'
import { statusInBracket } from './my-status'
import { podium } from './podium'
import { abcTeams, makeSlot, roundRobinBracket } from './test-fixtures/bracket'
import { makeTournamentTeam } from './test-fixtures/tournament'
import { GAMES } from '@/components/games'
import { Game } from '@/types'

const TABLES = GAMES[Game.BEERPONG].station

describe('everybody against everybody', () => {
  it('lays the matches out by match day, numbered on, without sources', () => {
    const layout = buildBracketLayout(roundRobinBracket())
    expect(layout.rounds.map((r) => r.slots.length)).toEqual([1, 1, 1])
    expect(allMatchSlots(layout).map((s) => [s.number, s.sources])).toEqual([
      [1, { a: null, b: null }],
      [2, { a: null, b: null }],
      [3, { a: null, b: null }],
    ])
    expect(roundTitle(layout, 2)).toBe('2. Spieltag')
  })

  it('has its podium from the table', () => {
    expect(podium(roundRobinBracket())).toBeNull()
    expect(podium(roundRobinBracket({ champion_team_id: 'a' }))).toEqual({ champion: 'a', runnerUp: 'c', third: ['b'] })
  })

  it('goes on after a defeat and gives the place once my matches are played', () => {
    const bracket = roundRobinBracket()
    const slots = allMatchSlots(buildBracketLayout(bracket))
    const b = makeTournamentTeam({ id: 'b', name: 'Bravo' })
    expect(statusInBracket(slots, bracket, b, abcTeams, TABLES)?.title).toMatch(/Charlie/) // next match, not "ausgeschieden"

    const done = roundRobinBracket({
      matches: bracket.matches.map((m) => ({ ...m, status: 'finished' as const, winner_team_id: m.team_a_id, score_a: 1, score_b: 0 })),
    })
    const all = allMatchSlots(buildBracketLayout(done))
    expect(statusInBracket(all, done, b, abcTeams, TABLES)?.title).toBe('Alle deine Spiele sind gespielt: Platz 3 mit Bravo.')
    expect(statusInBracket(all, { ...done, champion_team_id: 'a' }, b, abcTeams, TABLES)?.title).toBe(
      'Das Turnier ist vorbei: Platz 3 mit Bravo.',
    )
  })

  it('says a draw: no winner, no loser', () => {
    const s = makeSlot({ status: 'finished', winner_team_id: null, score_a: 1, score_b: 1 })
    const sides = describeSides(s, abcTeams)
    expect(sides.map((side) => side.isLoser)).toEqual([false, false])
    expect(matchSummary(s, sides, abcTeams, TABLES)).toBe('Spiel 7, Alpha (rot) gegen Bravo (blau), beendet, unentschieden, Ergebnis 1:1')
  })
})
