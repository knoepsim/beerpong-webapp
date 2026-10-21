import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TournamentCard } from '../tournament-card'
import type { MyTournament } from '@/lib/tournament-groups'
import { Game, type Team, type Tournament } from '@/types'
import { TournamentRoleType } from '@/types'

const tournament = (overrides: Partial<Tournament> = {}): Tournament =>
  ({
    id: 't1',
    slug: 'sommerfest',
    name: 'Sommerfest',
    location: 'Garten',
    start_time: '2026-10-14T20:17:00',
    created_at: '2026-01-01T10:00:00Z',
    phase: 'registration',
    started_at: null,
    finished_at: null,
    game: Game.BEERPONG,
    ...overrides,
  }) as Tournament

const card = (item: Partial<MyTournament> = {}, t: Partial<Tournament> = {}) =>
  render(<TournamentCard item={{ tournament: tournament(t), ...item }} />)

describe('TournamentCard', () => {
  it('links to the tournament', () => {
    card()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/t/sommerfest')
  })

  it('shows what, when and where, nothing else', () => {
    const { container } = card()
    expect(screen.getByRole('heading', { name: 'Sommerfest' })).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('Okt')).toBeInTheDocument()
    expect(screen.getByText(/20:17 Uhr/)).toBeInTheDocument()
    expect(screen.getByText('Garten')).toBeInTheDocument()
    expect(container.querySelector('p.line-clamp-3, .prose')).toBeNull() // no description snippet
  })

  it('works without a location', () => {
    card({}, { location: null })
    expect(screen.queryByText('Garten')).not.toBeInTheDocument()
  })

  it('falls back to the creation date without a start time', () => {
    card({}, { start_time: null, created_at: '2026-01-05T10:00:00' })
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Jan')).toBeInTheDocument()
  })

  it('names the state while the tournament is being prepared, for admins, managers and referees', () => {
    const { rerender } = card({ role: TournamentRoleType.MANAGER })
    expect(screen.getByText('Anmeldung offen')).toBeInTheDocument()

    rerender(<TournamentCard item={{ tournament: tournament({ phase: 'checkin' }), role: TournamentRoleType.REFEREE }} />)
    expect(screen.getByText('Check-in läuft')).toBeInTheDocument()

    // a player gets their own status instead of the state of the tournament
    rerender(<TournamentCard item={{ tournament: tournament({ phase: 'checkin' }), team: { id: 'x', name: 'A' } as Team }} />)
    expect(screen.queryByText('Check-in läuft')).not.toBeInTheDocument()
  })

  it('does not repeat the state of running and finished tournaments, the group heading says it', () => {
    const { rerender } = card({}, { phase: 'running', started_at: '2026-10-14T20:20:00Z' })
    expect(screen.queryByText('Läuft')).not.toBeInTheDocument()

    rerender(<TournamentCard item={{ tournament: tournament({ phase: 'finished', finished_at: '2026-10-14T23:00:00Z' }) }} />)
    expect(screen.queryByText('Beendet')).not.toBeInTheDocument()
  })

  it('shows my team and my role', () => {
    card({ team: { id: 'x', name: 'Die Becherhelden' } as Team, role: TournamentRoleType.MANAGER })
    expect(screen.getByText('Die Becherhelden')).toBeInTheDocument()
    expect(screen.getByText('Manager')).toBeInTheDocument()
  })

  it('names every role', () => {
    const { rerender } = card({ role: TournamentRoleType.ADMIN })
    expect(screen.getByText('Admin')).toBeInTheDocument()
    rerender(<TournamentCard item={{ tournament: tournament(), role: TournamentRoleType.REFEREE }} />)
    expect(screen.getByText('Schiedsrichter')).toBeInTheDocument()
  })

  it('dims a finished tournament and fills the date of a running one', () => {
    const { container, rerender } = card({}, { phase: 'running' })
    expect(container.querySelector('.bg-primary.text-primary-foreground')).not.toBeNull()

    rerender(<TournamentCard item={{ tournament: tournament({ phase: 'finished' }) }} />)
    expect(container.querySelector('.bg-primary.text-primary-foreground')).toBeNull()
    expect(screen.getByRole('heading').className).toContain('text-muted-foreground')
  })

  it('shows my status in a few words when there is something to know, nothing otherwise', () => {
    const team = { id: 'x', name: 'Becherhelden' } as Team
    const { rerender } = card(
      { team, participation: { is_checked_in: false, next_match: null, place: null } },
      { checkin_enabled: true, checkin_open: true },
    )
    expect(screen.getByText('Jetzt einchecken')).toBeInTheDocument()

    rerender(
      <TournamentCard
        item={{ tournament: tournament(), team, participation: { is_checked_in: false, next_match: null, place: null } }}
      />,
    )
    expect(screen.queryByText('Jetzt einchecken')).not.toBeInTheDocument()
  })
})
