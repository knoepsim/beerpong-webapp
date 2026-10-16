import { describe, expect, it } from 'vitest'
import { describeSides, matchSummary, statusLabel, tableLabel } from './match-display'
import { abTeams as teamsMap, makeSlot as slot } from './test-fixtures/bracket'

describe('describeSides', () => {
  it('gives the first team red and the second blue', () => {
    const [a, b] = describeSides(slot(), teamsMap)
    expect([a.side, a.name]).toEqual(['a', 'Alpha'])
    expect([b.side, b.name]).toEqual(['b', 'Bravo'])
  })

  it('marks winner and loser of a finished match, nobody before', () => {
    const open = describeSides(slot(), teamsMap)
    expect(open.map((s) => [s.isWinner, s.isLoser])).toEqual([[false, false], [false, false]])

    const done = describeSides(slot({ status: 'finished', winner_team_id: 'b' }), teamsMap)
    expect(done.map((s) => [s.isWinner, s.isLoser])).toEqual([[false, true], [true, false]])
  })

  it('names where a missing team comes from', () => {
    const [a, b] = describeSides(slot({ status: 'waiting', team_a_id: null, team_b_id: null }, { a: 3, b: null }), teamsMap)
    expect([a.name, a.placeholder]).toEqual([null, 'Sieger Spiel 3'])
    expect([b.name, b.placeholder]).toEqual([null, 'Offen'])
    expect([a.isWinner, a.isLoser]).toEqual([false, false])
  })

  it('falls back to "Unbekannt" for a team that is not in the map', () => {
    expect(describeSides(slot(), {})[0].name).toBe('Unbekannt')
  })

  it('marks the champion', () => {
    const [a, b] = describeSides(slot({ status: 'finished', winner_team_id: 'a' }), teamsMap, 'a')
    expect([a.isChampion, b.isChampion]).toEqual([true, false])
  })
})

describe('tableLabel', () => {
  it('shows the table a match is played at', () => {
    expect(tableLabel(slot({ table_id: 't4', table_name: 'Terrasse' }).match)).toBe('Terrasse')
  })

  it('shows the place in the queue of a match without a table', () => {
    expect(tableLabel(slot({ table_id: null, table_name: null, queue_position: 1 }).match)).toBe('Als Nächstes')
    expect(tableLabel(slot({ table_id: null, table_name: null, queue_position: 3 }).match)).toBe('Warteplatz 3')
  })

  it('has nothing to say for a match that waits for its teams', () => {
    expect(tableLabel(slot({ status: 'waiting' }).match)).toBeNull()
  })

  it('shows nothing for a finished match, even if it had a table', () => {
    expect(tableLabel(slot({ status: 'finished', winner_team_id: 'a' }).match)).toBeNull()
    expect(tableLabel(slot({ status: 'finished', winner_team_id: 'a', table_name: 'Tisch 2' }).match)).toBeNull()
  })
})

describe('statusLabel', () => {
  it('names every state', () => {
    expect(statusLabel(slot({ status: 'waiting' }).match)).toBe('Wartet')
    expect(statusLabel(slot().match)).toBe('Bereit')
    expect(statusLabel(slot({ status: 'finished', cups_left: 3 }).match)).toBe('3 Becher')
    expect(statusLabel(slot({ status: 'finished', cups_left: null }).match)).toBe('Beendet')
  })
})

describe('matchSummary', () => {
  it('describes a ready match with colors and table', () => {
    const s = slot()
    expect(matchSummary(s, describeSides(s, teamsMap), teamsMap)).toBe(
      'Spiel 7, Alpha (rot) gegen Bravo (blau), bereit, Tisch 1',
    )
  })

  it('describes a finished match with winner and cups', () => {
    const s = slot({ status: 'finished', winner_team_id: 'b', cups_left: 2 })
    expect(matchSummary(s, describeSides(s, teamsMap), teamsMap)).toBe(
      'Spiel 7, Alpha (rot) gegen Bravo (blau), beendet, Sieger Bravo, 2 Becher übrig',
    )
  })
})
