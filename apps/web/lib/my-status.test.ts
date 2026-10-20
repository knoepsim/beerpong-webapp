import { describe, expect, it } from 'vitest'
import { allMatchSlots, buildBracketLayout } from './bracket-layout'
import { knockoutPlace, listStatus, statusBeforeStart, statusInBracket } from './my-status'
import { fiveTeamBracket, fiveTeams } from './test-fixtures/bracket'
import { makeTournament as tournament, makeTournamentTeam as team } from './test-fixtures/tournament'
import type { Bracket, Match } from '@/types'

const NOW = new Date('2099-07-01T12:00:00Z')
const finished = (winner: string) => ({ status: 'finished' as const, winner_team_id: winner, score_a: 3, score_b: 0 })

function inBracket(bracket: Bracket, teamId: string, now = NOW) {
  const slots = allMatchSlots(buildBracketLayout(bracket))
  return statusInBracket(slots, bracket.total_rounds, team({ id: teamId, name: fiveTeams[teamId].name }), fiveTeams, bracket.champion_team_id, now)
}

describe('statusBeforeStart', () => {
  it('is all set when registered without check-in', () => {
    const s = statusBeforeStart(tournament(), team(), NOW)
    expect([s.tone, s.title]).toEqual(['done', 'Team 4 ist angemeldet.'])
    expect(s.detail).toMatch(/^Das Turnier beginnt heute, \d{2}:\d{2} Uhr\.$/)
  })

  it('is urgent while the check-in is open and the team is not checked in, and says the consequence', () => {
    const s = statusBeforeStart(tournament({ checkin_enabled: true, checkin_open: true }), team(), NOW)
    expect([s.tone, s.title, s.detail]).toEqual([
      'urgent',
      'Check jetzt vor Ort beim Orga-Team ein.',
      'Ohne Check-in wird Team 4 beim Turnierstart entfernt.',
    ])
  })

  it('is done once checked in', () => {
    const s = statusBeforeStart(tournament({ checkin_enabled: true, checkin_open: true }), team({ is_checked_in: true }), NOW)
    expect([s.tone, s.title]).toEqual(['done', 'Team 4 ist eingecheckt.'])
  })

  it('says when the check-in begins before it is open', () => {
    const s = statusBeforeStart(
      tournament({ checkin_enabled: true, checkin_auto_open: true, checkin_start_time: '2099-07-01T17:00:00Z' }),
      team(),
      NOW,
    )
    expect(s.tone).toBe('relaxed')
    expect(s.detail).toMatch(/^Der Check-in beginnt heute, \d{2}:\d{2} Uhr\.$/)
  })
})

describe('statusInBracket', () => {
  it('sends a team to its table when its match is ready there', () => {
    const s = inBracket(fiveTeamBracket(), 't4')!
    expect([s.tone, s.title, s.slot?.number]).toEqual(['urgent', 'Geh jetzt zu Tisch 1: Spiel gegen Team 5.', 1])
  })

  it('says where it plays while live', () => {
    const s = inBracket(fiveTeamBracket({ m1: { status: 'live' } }), 't4')!
    expect([s.tone, s.title]).toEqual(['active', 'Du spielst an Tisch 1 gegen Team 5.'])
  })

  it('gets the team ready when it is next in the queue, and lets it relax further back', () => {
    const queued = (place: number): Partial<Match> => ({ status: 'queued', table_id: null, table_name: null, queue_position: place })
    const next = inBracket(fiveTeamBracket({ m1: queued(1) }), 't4')!
    expect([next.tone, next.title]).toEqual(['attention', 'Halte dich bereit: Als Nächstes spielst du gegen Team 5.'])
    const later = inBracket(fiveTeamBracket({ m1: queued(3) }), 't4')!
    expect([later.tone, later.detail]).toEqual(['relaxed', 'Platz 3 in der Warteschlange.'])
  })

  it('tells a team waiting for its opponent who it can be and since when that match runs', () => {
    const live = (minutesAgo: number) =>
      fiveTeamBracket({ m1: { status: 'live', started_at: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString() } })
    const s = inBracket(live(8), 't1')!
    expect([s.tone, s.icon, s.title]).toEqual(['relaxed', 'pause', 'Pause: Du wartest auf deinen Gegner.'])
    expect(s.detail).toBe('Dein Gegner: Team 4 oder Team 5 – spielen an Tisch 1, seit 8 Minuten.')
    expect(inBracket(live(0), 't1')!.detail).toBe('Dein Gegner: Team 4 oder Team 5 – spielen an Tisch 1, gerade gestartet.')
  })

  it('shows no place in the queue while waiting for the opponent, the queue is the other match', () => {
    const s = inBracket(fiveTeamBracket({ m1: { status: 'queued', table_id: null, table_name: null, queue_position: 2 } }), 't1')!
    expect(s.detail).toBe('Dein Gegner: Team 4 oder Team 5 – warten noch auf einen Tisch.')
  })

  it('names the table of the next match when the API says it is certain, where the opponent plays now', () => {
    const bracket = fiveTeamBracket({
      m1: { status: 'live', started_at: new Date(NOW.getTime() - 5 * 60_000).toISOString() },
      m2: { upcoming_table_id: 'x1', upcoming_table_name: 'Tisch 1' },
    })
    const s = inBracket(bracket, 't1')!
    expect(s.detail).toBe('Euer Spiel ist danach an Tisch 1. Dort spielen gerade Team 4 und Team 5, seit 5 Minuten.')
    expect(s.slot?.match.upcoming_table_name).toBe('Tisch 1')
  })

  it('gives the place of a team that is out, and the winner its trophy', () => {
    const out = inBracket(fiveTeamBracket({ m1: finished('t4') }), 't5')!
    expect([out.icon, out.title]).toEqual(['award', 'Du bist ausgeschieden: Platz 5 mit Team 5.'])
    const champion = inBracket({ ...fiveTeamBracket(), champion_team_id: 't2' }, 't2')!
    expect([champion.icon, champion.title]).toEqual(['trophy', 'Du hast das Turnier gewonnen – Platz 1 mit Team 2!'])
  })
})

describe('knockoutPlace', () => {
  it('counts places from the final down', () => {
    expect([3, 2, 1].map((round) => knockoutPlace(round, 3))).toEqual([2, 3, 5])
  })
})

describe('listStatus', () => {
  const started = tournament({ started_at: '2099-07-01T18:00:00Z', registration_open: false, phase: 'running' })
  const part = (overrides = {}) => ({ is_checked_in: false, next_match: null, place: null, ...overrides })
  const match = (overrides: Partial<Match>) => fiveTeamBracket({ m1: overrides }).matches[0]

  it('says only what matters before the start: check in now, or checked in', () => {
    expect(listStatus(tournament(), part())).toBeNull() // registered, nothing to do
    expect(listStatus(tournament({ checkin_enabled: true, checkin_open: true }), part())).toEqual({
      tone: 'urgent', icon: 'alert', text: 'Jetzt einchecken',
    })
    expect(listStatus(tournament({ checkin_enabled: true }), part({ is_checked_in: true }))?.text).toBe('Eingecheckt')
    expect(listStatus(tournament({ checkin_enabled: true }), part())).toBeNull() // check-in not open yet
  })

  it('says where to go and how urgent while it runs', () => {
    expect(listStatus(started, part({ next_match: match({}) }))).toEqual({ tone: 'urgent', icon: 'go', text: 'Jetzt zu Tisch 1' })
    expect(listStatus(started, part({ next_match: match({ status: 'live' }) }))?.text).toBe('Spielt an Tisch 1')
    expect(listStatus(started, part({ next_match: match({ status: 'queued', queue_position: 1 }) }))?.tone).toBe('attention')
    expect(listStatus(started, part({ next_match: match({ status: 'queued', queue_position: 4 }) }))?.text).toBe('Warteschlange #4')
    expect(listStatus(started, part({ next_match: match({ status: 'waiting' }) }))?.text).toBe('Pause')
  })

  it('gives the place at the end', () => {
    expect(listStatus(started, part({ place: 1 }))).toEqual({ tone: 'done', icon: 'trophy', text: 'Gewonnen' })
    expect(listStatus(started, part({ place: 5 }))?.text).toBe('Platz 5')
  })
})
