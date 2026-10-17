import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { renderHook } from '@/lib/test-fixtures/render'
import { useTournament } from './use-tournament'
import { useCheckin, useCreateTournament, useInvitePreview, useMyTournaments, useStartTournament, useTournamentById } from './queries/tournaments'
import { api, ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { makeTournament, makeTournamentTeam } from '@/lib/test-fixtures/tournament'
import { fiveTeamBracket } from '@/lib/test-fixtures/bracket'
import type { LiveScope } from '@/lib/live-connection'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const live = vi.hoisted(() => ({ onChange: undefined as undefined | ((scopes: LiveScope[]) => Promise<void>) }))
vi.mock('./use-tournament-live', () => ({
  useTournamentLive: (options: { onChange: (scopes: LiveScope[]) => Promise<void> }) => {
    live.onChange = options.onChange
    return { status: 'live' }
  },
}))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: {
    tournaments: {
      getBySlug: vi.fn(),
      getPreview: vi.fn(),
      getTeams: vi.fn(),
      listTables: vi.fn(),
      getBracket: vi.fn(),
      checkin: vi.fn(),
      startTournament: vi.fn(),
      getMyTournaments: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
    },
    invites: { get: vi.fn() },
    roles: { list: vi.fn() },
  },
}))

const t = vi.mocked(api.tournaments)
const tournament = makeTournament({ id: 't1', slug: 'cup', revision: 3 } as never)
const team = makeTournamentTeam({ id: 'a', name: 'Alpha' })

beforeEach(() => {
  vi.clearAllMocks()
  t.getBySlug.mockResolvedValue(tournament)
  t.getTeams.mockResolvedValue([team])
  t.listTables.mockResolvedValue([])
  t.getBracket.mockResolvedValue({ tournament_id: 't1', total_rounds: 0, matches: [] } as never)
  vi.mocked(api.roles.list).mockResolvedValue([])
})

describe('useTournament', () => {
  it('waits for all parts, then has the tournament, its teams and no bracket before the start', async () => {
    const { result } = renderHook(() => useTournament('cup'))
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.tournament?.name).toBe('Cup')
    expect(result.current.teamsMap.a.name).toBe('Alpha')
    expect(result.current.bracket).toBeNull()
    expect(t.getTeams).toHaveBeenCalledWith('t1')
  })

  it('shows a stranger the preview of a tournament that is not visible', async () => {
    t.getBySlug.mockRejectedValue(new ApiError(403, { detail: 'Kein Zugriff' }))
    t.getPreview.mockResolvedValue({ name: 'Cup', registration_open: true } as never)
    const { result } = renderHook(() => useTournament('cup'))
    await waitFor(() => expect(result.current.preview?.name).toBe('Cup'))
    expect(result.current.isLoading).toBe(false)
    expect(t.getTeams).not.toHaveBeenCalled()
  })

  it('loads exactly the parts the live connection names', async () => {
    const { result } = renderHook(() => useTournament('cup'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    t.getBracket.mockResolvedValue(fiveTeamBracket())

    await act(() => live.onChange!(['bracket']))

    await waitFor(() => expect(result.current.bracket).not.toBeNull())
    expect(t.getTeams).toHaveBeenCalledTimes(1)
    expect(t.listTables).toHaveBeenCalledTimes(2) // the tables belong to the bracket
  })

  it('keeps the last state when a refresh fails, and says so once', async () => {
    const { result } = renderHook(() => useTournament('cup'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    t.getTeams.mockRejectedValue(new ApiError(500, { detail: 'Server hat ein Problem.' }))

    await act(() => live.onChange!(['teams']))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Server hat ein Problem.'))
    expect(result.current.teams).toHaveLength(1)
    expect(result.current.error).toBeNull()
  })
})

describe('useCheckin', () => {
  it('moves at once and jumps back with a toast when the server refuses', async () => {
    let refuse!: (e: unknown) => void
    t.checkin.mockReturnValue(new Promise((_, reject) => (refuse = reject)))
    const { result, client } = renderHook(() => useCheckin('t1'))
    client.setQueryData(queryKeys.tournamentTeams('t1'), [team])

    act(() => result.current.mutate({ teamId: 'a', checkedIn: true }))
    await waitFor(() => expect(client.getQueryData<typeof team[]>(queryKeys.tournamentTeams('t1'))?.[0].is_checked_in).toBe(true))

    refuse(new ApiError(409, { detail: 'Der Check-in ist geschlossen.' }))
    await waitFor(() => expect(client.getQueryData<typeof team[]>(queryKeys.tournamentTeams('t1'))?.[0].is_checked_in).toBe(false))
    expect(toast.error).toHaveBeenCalledWith('Der Check-in ist geschlossen.')
  })
})

describe('useStartTournament', () => {
  it('says how many teams without check-in were removed', async () => {
    t.startTournament.mockResolvedValue({ removed_team_ids: ['x', 'y'] } as never)
    const { result } = renderHook(() => useStartTournament('t1'))
    await act(() => result.current.mutateAsync())
    expect(toast.success).toHaveBeenCalledWith('Turnier gestartet. 2 Teams ohne Check-in entfernt.')
  })
})

describe('lookups and lists', () => {
  it('load my tournaments, a tournament by its old id and the tournament behind an invitation', async () => {
    t.getMyTournaments.mockResolvedValue({ participating: [], managing: [] } as never)
    t.get.mockResolvedValue(tournament)
    vi.mocked(api.invites.get).mockResolvedValue({ name: 'Cup' } as never)
    const mine = renderHook(() => useMyTournaments())
    const byId = renderHook(() => useTournamentById('t1'))
    const invite = renderHook(() => useInvitePreview('tok'))
    await waitFor(() => expect(mine.result.current.isSuccess && byId.result.current.isSuccess && invite.result.current.isSuccess).toBe(true))
    expect(byId.result.current.data?.slug).toBe('cup')
    expect(api.invites.get).toHaveBeenCalledWith('tok')
  })

  it('creates a tournament and leaves its errors to the form', async () => {
    t.create.mockResolvedValue(tournament)
    const { result } = renderHook(() => useCreateTournament())
    await act(() => result.current.mutateAsync({ name: 'Cup' } as never))
    expect(toast.success).toHaveBeenCalledWith('Turnier erstellt.')

    t.create.mockRejectedValue(new ApiError(422, { detail: 'Name fehlt.' }))
    await act(() => result.current.mutateAsync({} as never).catch(() => {}))
    expect(toast.error).not.toHaveBeenCalled()
  })
})
