import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TournamentHeader } from '../tournament-header'
import { TournamentControlCard } from '../tournament-control-card'
import { TournamentTeamsTab } from '../tournament-teams-tab'
import { LoadError } from '../load-error'
import { ApiError } from '@/lib/api'
import { makeTournament, makeTournamentTeam } from '@/lib/test-fixtures/tournament'
import { JoinPolicy } from '@/types'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

describe('TournamentHeader', () => {
  it('shows name, phase, place and the number of teams', () => {
    render(<TournamentHeader tournament={makeTournament({ location: 'Garten' })} teamCount={1} />)
    expect(screen.getByRole('heading', { name: 'Cup' })).toBeInTheDocument()
    expect(screen.getByText('Garten')).toBeInTheDocument()
    expect(screen.getByText('1 Team')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cup teilen' })).toBeInTheDocument()
  })

  it('offers no sharing when only invited teams may join', () => {
    render(<TournamentHeader tournament={makeTournament({ join_policy: JoinPolicy.INVITE_ONLY })} teamCount={4} />)
    expect(screen.queryByRole('button', { name: /teilen/ })).not.toBeInTheDocument()
    expect(screen.getByText('4 Teams')).toBeInTheDocument()
  })
})

describe('TournamentHeader: sharing', () => {
  it('shares the plain address where the phone can share', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    render(<TournamentHeader tournament={makeTournament({ slug: 'cup' } as never)} teamCount={2} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cup teilen' }))
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: 'Cup', url: `${window.location.origin}/t/cup` }))
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
  })

  it('copies the address elsewhere and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<TournamentHeader tournament={makeTournament({ slug: 'cup' } as never)} teamCount={2} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cup teilen' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/t/cup`))
    expect(toast.success).toHaveBeenCalledWith('Turnier-Link kopiert.')
  })
})

describe('TournamentControlCard', () => {
  const props = { isStarting: false, onSetOpen: vi.fn(), onStart: vi.fn() }

  it('explains why the start is not possible yet', () => {
    render(<TournamentControlCard {...props} tournament={makeTournament()} teams={[makeTournamentTeam()]} />)
    expect(screen.getByRole('button', { name: 'Turnier starten' })).toBeDisabled()
    expect(screen.getByText(/mindestens/i)).toBeInTheDocument()
  })

  it('starts with enough teams and shows that it runs', () => {
    const teams = [makeTournamentTeam({ id: 'a' }), makeTournamentTeam({ id: 'b' })]
    const { rerender } = render(<TournamentControlCard {...props} tournament={makeTournament()} teams={teams} />)
    fireEvent.click(screen.getByRole('button', { name: 'Turnier starten' }))
    expect(props.onStart).toHaveBeenCalled()

    rerender(<TournamentControlCard {...props} isStarting tournament={makeTournament()} teams={teams} />)
    expect(screen.getByRole('button', { name: 'Wird gestartet…' })).toBeDisabled()
  })

  it('switches registration and check-in', () => {
    const onSetOpen = vi.fn()
    const tournament = makeTournament({ checkin_enabled: true })
    render(<TournamentControlCard {...props} onSetOpen={onSetOpen} tournament={tournament} teams={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Anmeldung schließen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check-in öffnen' }))
    expect(onSetOpen).toHaveBeenCalledWith('registration', false)
    expect(onSetOpen).toHaveBeenCalledWith('checkin', true)
  })

  it('points to the results after the start', () => {
    render(<TournamentControlCard {...props} tournament={makeTournament({ started_at: '2026-01-01T18:00:00Z' })} teams={[]} />)
    expect(screen.getByText('Ergebnisse können im Spielplan eingetragen werden.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turnier starten' })).not.toBeInTheDocument()
  })
})

describe('TournamentTeamsTab', () => {
  const handlers = { onCheckin: vi.fn(), onRemove: vi.fn(), canManage: false }

  it('says that nobody registered yet', () => {
    render(<TournamentTeamsTab {...handlers} tournament={makeTournament()} teams={[]} />)
    expect(screen.getByText('Noch keine Teams angemeldet.')).toBeInTheDocument()
  })

  it('says when the check-in begins while it is not open yet', () => {
    const tournament = makeTournament({ checkin_enabled: true, checkin_auto_open: true, checkin_start_time: '2099-07-01T17:00:00Z' })
    render(<TournamentTeamsTab {...handlers} tournament={tournament} teams={[makeTournamentTeam({ name: 'Alpha' })]} />)
    expect(screen.getByText(/Der Check-in beginnt/)).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })
})

describe('LoadError', () => {
  it('says what went wrong and loads again', () => {
    const onRetry = vi.fn()
    render(<LoadError error={new ApiError(500, { detail: 'Server hat ein Problem.' })} fallback="x" onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Server hat ein Problem.')
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(onRetry).toHaveBeenCalled()
  })
})
