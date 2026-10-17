import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderHook } from '@/lib/test-fixtures/render'
import { useTournamentActions } from './use-tournament-actions'
import { api } from '@/lib/api'
import { makeTournament, makeTournamentTeam } from '@/lib/test-fixtures/tournament'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: {
    tournaments: {
      leave: vi.fn(),
      removeTeam: vi.fn(),
      checkin: vi.fn(),
      setRegistrationOpen: vi.fn(),
      setCheckinOpen: vi.fn(),
      startTournament: vi.fn(),
    },
  },
}))

const t = vi.mocked(api.tournaments)
const alpha = makeTournamentTeam({ id: 'a', name: 'Alpha' })
const bravo = makeTournamentTeam({ id: 'b', name: 'Bravo' })
const tournament = makeTournament({ id: 't1' })

const setup = (teams = [alpha, bravo], current = tournament) => renderHook(() => useTournamentActions(current, teams))
const confirmWith = async (label: string) => {
  fireEvent.click(await screen.findByRole('button', { name: label }))
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of Object.values(t)) fn.mockResolvedValue(undefined as never)
})

describe('useTournamentActions', () => {
  it('leaves the tournament after a confirmation that names the team', async () => {
    const { result } = setup()
    act(() => result.current.leaveTournament(alpha))
    expect(await screen.findByText(/Alpha wird vom Turnier abgemeldet/)).toBeInTheDocument()
    await confirmWith('Turnier verlassen')
    await waitFor(() => expect(t.leave).toHaveBeenCalledWith('t1'))
    expect(toast.success).toHaveBeenCalledWith('Du hast das Turnier verlassen.')
  })

  it('removes a team after a confirmation', async () => {
    const { result } = setup()
    act(() => result.current.removeTeam(bravo))
    await confirmWith('Team entfernen')
    await waitFor(() => expect(t.removeTeam).toHaveBeenCalledWith('t1', 'b'))
    expect(toast.success).toHaveBeenCalledWith('Bravo entfernt.')
  })

  it('checks a team in right away', async () => {
    const { result } = setup()
    act(() => result.current.setCheckedIn(alpha, true))
    await waitFor(() => expect(t.checkin).toHaveBeenCalledWith('t1', 'a', true))
  })

  it('switches the registration right away, but asks before opening the check-in', async () => {
    const { result } = setup()
    act(() => result.current.setOpen('registration', false))
    await waitFor(() => expect(t.setRegistrationOpen).toHaveBeenCalledWith('t1', false))
    expect(toast.success).toHaveBeenCalledWith('Anmeldung geschlossen.')

    act(() => result.current.setOpen('checkin', true))
    expect(t.setCheckinOpen).not.toHaveBeenCalled()
    await confirmWith('Check-in öffnen')
    await waitFor(() => expect(t.setCheckinOpen).toHaveBeenCalledWith('t1', true))
  })

  it('starts after a confirmation that names the consequences', async () => {
    t.startTournament.mockResolvedValue({ removed_team_ids: [] } as never)
    const { result } = setup()
    act(() => result.current.startTournament())
    expect(await screen.findByText(/Die Anmeldung wird geschlossen/)).toBeInTheDocument()
    await confirmWith('Turnier starten')
    await waitFor(() => expect(t.startTournament).toHaveBeenCalledWith('t1'))
    expect(toast.success).toHaveBeenCalledWith('Turnier gestartet.')
  })

  it('does not ask to start what cannot start, and says why', () => {
    const { result } = setup([alpha])
    act(() => result.current.startTournament())
    expect(toast.error).toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('does nothing without a tournament', () => {
    const { result } = renderHook(() => useTournamentActions(undefined, []))
    act(() => result.current.startTournament())
    expect(toast.error).not.toHaveBeenCalled()
  })
})
