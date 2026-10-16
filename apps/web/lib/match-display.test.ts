import { describe, expect, it } from 'vitest'
import { describeSides, isOpen, matchSummary, statusLabel, statusText, tableOf } from './match-display'
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

describe('tableOf', () => {
  it('shows the table only while the match is at it', () => {
    expect(tableOf(slot({ table_name: 'Terrasse' }).match)).toBe('Terrasse')
    expect(tableOf(slot({ status: 'live', table_name: 'Terrasse' }).match)).toBe('Terrasse')
    expect(tableOf(slot({ status: 'queued', table_name: null }).match)).toBeNull()
    expect(tableOf(slot({ status: 'waiting', table_name: null, upcoming_table_name: 'Tisch 2' }).match)).toBe('Tisch 2')
    expect(tableOf(slot({ status: 'waiting', table_name: null }).match)).toBeNull()
    expect(tableOf(slot({ status: 'finished', winner_team_id: 'a', table_name: 'Tisch 2' }).match)).toBeNull()
  })
})

describe('statusLabel', () => {
  it('is short next to the icon, the full text is in statusText', () => {
    expect(statusLabel(slot({ status: 'waiting' }).match)).toBe('Wartet')
    expect(statusLabel(slot({ status: 'queued', queue_position: 2 }).match)).toBe('Platz 2')
    expect(statusLabel(slot().match)).toBe('Bereit')
    expect(statusLabel(slot({ status: 'live' }).match)).toBe('Live')
    expect(statusLabel(slot({ status: 'finished', cups_left: 3 }).match)).toBe('3 Becher')
    expect(statusLabel(slot({ status: 'finished', cups_left: null }).match)).toBe('Beendet')
    expect(statusText(slot({ status: 'waiting' }).match)).toBe('Wartet auf Team')
    expect(statusText(slot({ status: 'queued', queue_position: 2 }).match)).toBe('Wartet auf Tisch, Platz 2 in der Warteschlange')
    expect(statusText(slot({ status: 'finished' }).match)).toBeNull()
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
