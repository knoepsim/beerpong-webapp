import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { renderHook } from '@/lib/test-fixtures/render'
import { useAcceptInviteLink, useInvitation, useMyInvitations, useTournamentInvitations } from './invitations'
import { api } from '@/lib/api'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: {
    invites: { accept: vi.fn() },
    invitations: { list: vi.fn(), get: vi.fn() },
    tournaments: { listInvitations: vi.fn() },
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('invitation hooks', () => {
  it('load my invitations only with a login, one of them, and those of a tournament', async () => {
    vi.mocked(api.invitations.list).mockResolvedValue([])
    vi.mocked(api.invitations.get).mockResolvedValue({ id: 'i1' } as never)
    vi.mocked(api.tournaments.listInvitations).mockResolvedValue([])

    const off = renderHook(() => useMyInvitations({ enabled: false }))
    expect(off.result.current.fetchStatus).toBe('idle')
    const mine = renderHook(() => useMyInvitations())
    const one = renderHook(() => useInvitation('i1'))
    const orga = renderHook(() => useTournamentInvitations('t1'))
    await waitFor(() =>
      expect(mine.result.current.isSuccess && one.result.current.isSuccess && orga.result.current.isSuccess).toBe(true),
    )
    expect(api.tournaments.listInvitations).toHaveBeenCalledWith('t1')
    expect(renderHook(() => useTournamentInvitations('')).result.current.fetchStatus).toBe('idle')
  })

  it('keep the invitation of a link in my account', async () => {
    vi.mocked(api.invites.accept).mockResolvedValue({ id: 'i1', status: 'pending' } as never)
    const { result } = renderHook(() => useAcceptInviteLink())
    await act(() => result.current.mutateAsync('tok'))
    expect(api.invites.accept).toHaveBeenCalledWith('tok')
  })
})
