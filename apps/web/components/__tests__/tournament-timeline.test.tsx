import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TournamentTimeline } from '../tournament-timeline'
import { CheckinSummary } from '../checkin-summary'
import type { Tournament, TournamentTeam } from '@/types'

const tournament = (overrides: Partial<Tournament> = {}): Tournament =>
  ({
    id: 't1',
    start_time: '2099-07-01T18:00:00Z',
    registration_end_time: null,
    checkin_enabled: false,
    checkin_start_time: null,
    started_at: null,
    phase: 'registration',
    registration_open: true,
    checkin_open: false,
    ...overrides,
  }) as Tournament

describe('TournamentTimeline', () => {
  it('has two steps without check-in', () => {
    render(<TournamentTimeline tournament={tournament()} hasWinner={false} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText('Check-in vor Ort')).not.toBeInTheDocument()
    expect(screen.getByText('Offen bis zum Start')).toBeInTheDocument()
  })

  it('adds the check-in step when it is enabled and marks the current one', () => {
    render(
      <TournamentTimeline
        tournament={tournament({
          checkin_enabled: true,
          checkin_open: true,
          registration_open: false,
          phase: 'checkin',
        })}
        hasWinner={false}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[1]).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Geöffnet')).toBeInTheDocument()
  })

  it('announces the deadline and the opening time', () => {
    render(
      <TournamentTimeline
        tournament={tournament({
          registration_end_time: '2099-06-30T18:00:00Z',
          checkin_enabled: true,
          checkin_start_time: '2099-07-01T17:00:00Z',
        })}
        hasWinner={false}
      />,
    )
    expect(screen.getByText(/^Bis /)).toBeInTheDocument()
    expect(screen.getByText(/^Ab /)).toBeInTheDocument()
  })

  it('shows a running and a finished tournament', () => {
    const running = tournament({ phase: 'running', registration_open: false, started_at: '2099-07-01T18:05:00Z' })
    const { rerender } = render(<TournamentTimeline tournament={running} hasWinner={false} />)
    expect(screen.getByText(/^Läuft/)).toBeInTheDocument()

    rerender(<TournamentTimeline tournament={running} hasWinner />)
    expect(screen.getByText(/^Beendet/)).toBeInTheDocument()
  })
})

describe('CheckinSummary', () => {
  const team = (id: string, checkedIn: boolean) => ({ id, is_checked_in: checkedIn }) as TournamentTeam

  it('counts the checked-in teams', () => {
    render(<CheckinSummary teams={[team('a', true), team('b', false), team('c', true)]} />)
    expect(screen.getByText('2 von 3 Teams eingecheckt')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '3')
  })

  it('handles no teams', () => {
    render(<CheckinSummary teams={[]} />)
    expect(screen.getByText('0 von 0 Teams eingecheckt')).toBeInTheDocument()
  })
})
