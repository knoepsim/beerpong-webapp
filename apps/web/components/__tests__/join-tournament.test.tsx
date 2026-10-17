import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@/lib/test-fixtures/render'
import { JoinTournament } from '../join-tournament'
import { api, ApiError } from '@/lib/api'
import type { Team } from '@/types'

const push = vi.fn()
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const useCurrentUser = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/hooks/queries/user', () => ({ useCurrentUser: () => useCurrentUser() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()), api: { teams: { list: vi.fn() }, tournaments: { join: vi.fn() } } }))

const team = (id: string, name: string): Team => ({ id, name, is_complete: true }) as Team
const mocked = { teams: vi.mocked(api.teams.list), join: vi.mocked(api.tournaments.join) }

const open = (onJoined = vi.fn(), inviteToken?: string) => {
  render(<JoinTournament tournamentId="t1" tournamentName="Sommerfest" inviteToken={inviteToken} loginRedirect="/t/sommerfest" onJoined={onJoined} />)
  fireEvent.click(screen.getByText('Mit Team beitreten'))
  return onJoined
}

beforeEach(() => {
  vi.clearAllMocks()
  useCurrentUser.mockReturnValue({ user: { id: 'u1' }, isLoading: false })
})
afterEach(() => cleanup())

describe('JoinTournament', () => {
  it('asks somebody without login to log in first and brings them back', () => {
    useCurrentUser.mockReturnValue({ user: null, isLoading: false })
    render(<JoinTournament tournamentId="t1" tournamentName="Sommerfest" loginRedirect="/t/sommerfest" onJoined={vi.fn()} />)
    const link = screen.getByRole('link', { name: 'Anmelden und beitreten' })
    expect(link).toHaveAttribute('href', `/login?redirect=${encodeURIComponent('/t/sommerfest')}`)
    expect(mocked.teams).not.toHaveBeenCalled()
  })

  it('shows nothing while it is not yet known whether somebody is logged in', () => {
    useCurrentUser.mockReturnValue({ user: null, isLoading: true })
    const { container } = render(<JoinTournament tournamentId="t1" tournamentName="X" loginRedirect="/t/x" onJoined={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('joins with the only team without asking, passing the invitation link', async () => {
    mocked.teams.mockResolvedValue([team('a', 'Becherhelden')])
    mocked.join.mockResolvedValue(undefined as never)
    const onJoined = open(vi.fn(), 'abc2345')

    fireEvent.click(await screen.findByRole('button', { name: 'Jetzt teilnehmen' }))

    await waitFor(() => expect(mocked.join).toHaveBeenCalledWith('t1', 'a', 'abc2345'))
    await waitFor(() => expect(onJoined).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith('Du bist dabei. Viel Erfolg!')
  })

  it('sends somebody without a team to the teams page', async () => {
    mocked.teams.mockResolvedValue([])
    open()
    fireEvent.click(await screen.findByText('Zu meinen Teams'))
    expect(push).toHaveBeenCalledWith('/teams')
    expect(mocked.join).not.toHaveBeenCalled()
  })

  it('shows what the server says when joining is refused', async () => {
    mocked.teams.mockResolvedValue([team('a', 'Becherhelden')])
    mocked.join.mockRejectedValue(new ApiError(403, { detail: 'Zum Beitreten brauchst du einen Einladungslink.' }))
    const onJoined = open()

    fireEvent.click(await screen.findByRole('button', { name: 'Jetzt teilnehmen' }))

    expect(await screen.findByText('Zum Beitreten brauchst du einen Einladungslink.')).toBeInTheDocument()
    expect(onJoined).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled() // it is said in the dialog, not twice
  })
})
