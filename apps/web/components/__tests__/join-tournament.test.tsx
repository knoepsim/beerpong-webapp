import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@/lib/test-fixtures/render'
import { JoinTournament } from '../join-tournament'
import { api, ApiError } from '@/lib/api'
import type { Team } from '@/types'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const useCurrentUser = vi.fn()
vi.mock('@/hooks/queries/user', () => ({ useCurrentUser: () => useCurrentUser() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { teams: { list: vi.fn(), create: vi.fn(), createInvite: vi.fn() }, tournaments: { join: vi.fn() } },
}))

const team = (id: string, name: string, complete = true): Team =>
  ({
    id,
    name,
    max_size: 2,
    is_complete: complete,
    members: complete ? [{ user_id: 'a', name: 'Ada' }, { user_id: 'b', name: 'Ben' }] : [{ user_id: 'a', name: 'Ada' }],
  }) as unknown as Team
const mocked = { teams: vi.mocked(api.teams.list), join: vi.mocked(api.tournaments.join) }

const open = (onJoined = vi.fn()) => {
  render(<JoinTournament tournamentId="t1" tournamentName="Sommerfest" loginRedirect="/t/sommerfest" onJoined={onJoined} />)
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
    render(<JoinTournament tournamentId="t1" tournamentName="Sommerfest" loginRedirect="/t/sommerfest" />)
    const link = screen.getByRole('link', { name: 'Anmelden und beitreten' })
    expect(link).toHaveAttribute('href', `/login?redirect=${encodeURIComponent('/t/sommerfest')}`)
    expect(mocked.teams).not.toHaveBeenCalled()
  })

  it('shows nothing while it is not yet known whether somebody is logged in', () => {
    useCurrentUser.mockReturnValue({ user: null, isLoading: true })
    const { container } = render(<JoinTournament tournamentId="t1" tournamentName="X" loginRedirect="/t/x" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('joins with the complete team, which is chosen already', async () => {
    mocked.teams.mockResolvedValue([team('s', 'Solo', false), team('a', 'Becherhelden')])
    mocked.join.mockResolvedValue(undefined as never)
    const onJoined = open()

    expect(await screen.findByRole('radio', { name: /Becherhelden/ })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Mit Becherhelden beitreten' }))

    await waitFor(() => expect(mocked.join).toHaveBeenCalledWith('t1', 'a'))
    await waitFor(() => expect(onJoined).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith('Du bist dabei. Viel Erfolg!')
  })

  it('does not offer to join with a team that is not complete, but the way to the team mate', async () => {
    mocked.teams.mockResolvedValue([team('s', 'Solo', false)])
    open()
    expect(await screen.findByText(/Solo braucht noch einen Mitspieler/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /beitreten$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mitspieler einladen' })).toBeInTheDocument()
  })

  it('founds a team right in the dialog when there is none', async () => {
    mocked.teams.mockResolvedValue([])
    open()
    expect(await screen.findByLabelText('Name deines Teams')).toBeInTheDocument()
    expect(mocked.join).not.toHaveBeenCalled()
  })

  it('shows what the server says when joining is refused', async () => {
    mocked.teams.mockResolvedValue([team('a', 'Becherhelden')])
    mocked.join.mockRejectedValue(new ApiError(409, { detail: 'Ein Spieler spielt schon mit.' }))
    const onJoined = open()

    fireEvent.click(await screen.findByRole('button', { name: 'Mit Becherhelden beitreten' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ein Spieler spielt schon mit.')
    expect(onJoined).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled() // said in the dialog, not twice
  })
})
