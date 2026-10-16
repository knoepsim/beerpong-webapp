import { describe, expect, it } from 'vitest'
import { allMatchSlots, buildBracketLayout } from './bracket-layout'
import { knockoutPlace, statusBeforeStart, statusInBracket } from './my-status'
import { fiveTeamBracket, fiveTeams } from './test-fixtures/bracket'
import { makeTournament as tournament, makeTournamentTeam as team } from './test-fixtures/tournament'
import type { Bracket, Match } from '@/types'

const NOW = new Date('2099-07-01T12:00:00Z')
const finished = (winner: string) => ({ status: 'finished' as const, winner_team_id: winner, cups_left: 3 })

function inBracket(bracket: Bracket, teamId: string) {
  const slots = allMatchSlots(buildBracketLayout(bracket))
  return statusInBracket(slots, bracket.total_rounds, team({ id: teamId, name: fiveTeams[teamId].name }), fiveTeams, bracket.champion_team_id)
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

  it('tells a team waiting for its opponent who it can be and how far that match is', () => {
    const s = inBracket(fiveTeamBracket({ m1: { status: 'live' } }), 't1')!
    expect([s.tone, s.icon, s.title]).toEqual(['relaxed', 'pause', 'Pause: Du wartest auf deinen Gegner.'])
    expect(s.detail).toBe('Dein Gegner: Team 4 oder Team 5 (Spiel 1 – läuft an Tisch 1).')
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
