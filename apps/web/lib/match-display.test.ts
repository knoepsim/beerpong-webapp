import { describe, expect, it } from 'vitest'
import { describeSides, isOpen, matchSummary, statusDetail, statusLabel } from './match-display'
import type { Match } from '@/types'
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

describe('statusDetail', () => {
  const waiting = (a: string | null, b: string | null, sources = { a: 3, b: 4 }) =>
    slot({ status: 'waiting', team_a_id: a, team_b_id: b, table_id: null, table_name: null }, sources)

  it('says which team is still in which match, by color', () => {
    expect(statusDetail(waiting('a', null))).toBe('Blau noch in Spiel 4')
    expect(statusDetail(waiting(null, 'b'))).toBe('Rot noch in Spiel 3')
    expect(statusDetail(waiting(null, null))).toBe('Beide Teams offen')
  })

  it('shows the place in the queue of a match without a table', () => {
    expect(statusDetail(slot({ status: 'queued', table_id: null, table_name: null, queue_position: 3 }))).toBe(
      'Warteschlange #3',
    )
  })

  it('shows the table of a match at its table or live', () => {
    expect(statusDetail(slot({ table_name: 'Terrasse' }))).toBe('Terrasse')
    expect(statusDetail(slot({ status: 'live', table_name: 'Terrasse' }))).toBe('Terrasse')
  })

  it('shows nothing for a finished match, even if it had a table', () => {
    expect(statusDetail(slot({ status: 'finished', winner_team_id: 'a', table_name: 'Tisch 2' }))).toBeNull()
  })
})

describe('statusLabel', () => {
  it('names every state', () => {
    expect(statusLabel(slot({ status: 'waiting' }).match)).toBe('Wartet auf Team')
    expect(statusLabel(slot({ status: 'queued' }).match)).toBe('Wartet auf Tisch')
    expect(statusLabel(slot().match)).toBe('Bereit')
    expect(statusLabel(slot({ status: 'live' }).match)).toBe('Live')
    expect(statusLabel(slot({ status: 'finished', cups_left: 3 }).match)).toBe('3 Becher')
    expect(statusLabel(slot({ status: 'finished', cups_left: null }).match)).toBe('Beendet')
  })
})

describe('isOpen', () => {
  it('is true from the queue until the result', () => {
    expect(['waiting', 'queued', 'ready', 'live', 'finished'].map((status) => isOpen(slot({ status: status as Match['status'] }).match)))
      .toEqual([false, true, true, true, false])
  })
})

describe('matchSummary', () => {
  it('describes a ready match with colors and table', () => {
    const s = slot()
    expect(matchSummary(s, describeSides(s, teamsMap), teamsMap)).toBe(
      'Spiel 7, Alpha (rot) gegen Bravo (blau), Bereit, Tisch 1',
    )
  })

  it('describes a finished match with winner and cups', () => {
    const s = slot({ status: 'finished', winner_team_id: 'b', cups_left: 2 })
    expect(matchSummary(s, describeSides(s, teamsMap), teamsMap)).toBe(
      'Spiel 7, Alpha (rot) gegen Bravo (blau), beendet, Sieger Bravo, 2 Becher übrig',
    )
  })
})
