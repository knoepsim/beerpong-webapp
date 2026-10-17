import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { renderHook } from '@/lib/test-fixtures/render'
import {
  useAcceptTeamInvite,
  useCreateTeam,
  useCreateTeamInvite,
  useDeleteTeam,
  useMyTeams,
  useRenameTeam,
  useTeamInvite,
} from './teams'
import { useRequestCode, useRequestPhoneChange, useUpdateMe, useUserSearch, useVerifyCode, useVerifyPhoneChange } from './user'
import { api, ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { Team, User } from '@/types'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: {
    teams: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createInvite: vi.fn(),
      getInviteDetails: vi.fn(),
      acceptInvite: vi.fn(),
    },
    users: { me: vi.fn(), updateMe: vi.fn(), search: vi.fn(), requestPhoneChange: vi.fn(), verifyPhoneChange: vi.fn() },
    auth: { requestCode: vi.fn(), verify: vi.fn() },
  },
}))

const team = { id: 'a', name: 'Becherhelden' } as Team
const user = { id: 'u1', name: 'Ada' } as User

beforeEach(() => vi.clearAllMocks())

describe('team hooks', () => {
  it('load my teams only when asked to', async () => {
    vi.mocked(api.teams.list).mockResolvedValue([team])
    const off = renderHook(() => useMyTeams({ enabled: false }))
    expect(off.result.current.fetchStatus).toBe('idle')
    const on = renderHook(() => useMyTeams())
    await waitFor(() => expect(on.result.current.data).toEqual([team]))
  })

  it('found a team, say so and load the list again', async () => {
    vi.mocked(api.teams.create).mockResolvedValue(team)
    const { result, client } = renderHook(() => useCreateTeam())
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await act(() => result.current.mutateAsync('Becherhelden'))
    expect(toast.success).toHaveBeenCalledWith('Becherhelden gegründet.')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.teams })
  })

  it('leave the error of a new name to the form', async () => {
    vi.mocked(api.teams.create).mockRejectedValue(new ApiError(409, { detail: 'Den Namen gibt es schon.' }))
    const { result } = renderHook(() => useCreateTeam())
    await act(() => result.current.mutateAsync('X').catch(() => {}))
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('rename, delete and invite', async () => {
    vi.mocked(api.teams.update).mockResolvedValue(team)
    vi.mocked(api.teams.delete).mockResolvedValue(undefined)
    vi.mocked(api.teams.createInvite).mockResolvedValue({ token: 'abc' } as never)
    const rename = renderHook(() => useRenameTeam())
    const remove = renderHook(() => useDeleteTeam())
    const invite = renderHook(() => useCreateTeamInvite())

    await act(() => rename.result.current.mutateAsync({ id: 'a', name: 'Neu' }))
    await act(() => remove.result.current.mutateAsync('a'))
    await act(() => invite.result.current.mutateAsync('a'))

    expect(api.teams.update).toHaveBeenCalledWith('a', 'Neu')
    expect(api.teams.delete).toHaveBeenCalledWith('a')
    expect(api.teams.createInvite).toHaveBeenCalledWith('a')
    expect(toast.success).toHaveBeenCalledWith('Team umbenannt.')
    expect(toast.success).toHaveBeenCalledWith('Team gelöscht.')
  })

  it('show and accept an invitation', async () => {
    vi.mocked(api.teams.getInviteDetails).mockResolvedValue({ team_name: 'Becherhelden' } as never)
    vi.mocked(api.teams.acceptInvite).mockResolvedValue(team)
    const details = renderHook(() => useTeamInvite('tok'))
    await waitFor(() => expect(details.result.current.data).toEqual({ team_name: 'Becherhelden' }))

    const accept = renderHook(() => useAcceptTeamInvite('tok'))
    await act(() => accept.result.current.mutateAsync())
    expect(api.teams.acceptInvite).toHaveBeenCalledWith('tok')
    expect(toast.success).toHaveBeenCalledWith('Du bist jetzt im Team Becherhelden.')
  })
})

describe('user hooks', () => {
  it('put the saved profile into the cache and say it', async () => {
    vi.mocked(api.users.updateMe).mockResolvedValue({ ...user, name: 'Ada Neu' })
    const { result, client } = renderHook(() => useUpdateMe({ successMessage: 'Profil gespeichert.' }))
    await act(() => result.current.mutateAsync({ name: 'Ada Neu' }))
    expect(client.getQueryData<User>(queryKeys.me)?.name).toBe('Ada Neu')
    expect(toast.success).toHaveBeenCalledWith('Profil gespeichert.')
  })

  it('change the phone number in two steps', async () => {
    vi.mocked(api.users.requestPhoneChange).mockResolvedValue(undefined)
    vi.mocked(api.users.verifyPhoneChange).mockResolvedValue({ ...user, phone_number: '+49151' })
    const request = renderHook(() => useRequestPhoneChange())
    const verify = renderHook(() => useVerifyPhoneChange())
    await act(() => request.result.current.mutateAsync('+49151'))
    await act(() => verify.result.current.mutateAsync({ phoneNumber: '+49151', code: '123456' }))
    expect(api.users.verifyPhoneChange).toHaveBeenCalledWith('+49151', '123456')
    expect(verify.client.getQueryData<User>(queryKeys.me)?.phone_number).toBe('+49151')
    expect(toast.success).toHaveBeenCalledWith('Handynummer geändert.')
  })

  it('search only from two characters on', async () => {
    vi.mocked(api.users.search).mockResolvedValue([])
    const short = renderHook(() => useUserSearch('a'))
    expect(short.result.current.fetchStatus).toBe('idle')
    const long = renderHook(() => useUserSearch('ad'))
    await waitFor(() => expect(long.result.current.isSuccess).toBe(true))
    expect(api.users.search).toHaveBeenCalledWith('ad')
  })

  it('log in and answer who that is', async () => {
    vi.mocked(api.auth.requestCode).mockResolvedValue(undefined)
    vi.mocked(api.auth.verify).mockResolvedValue(undefined)
    vi.mocked(api.users.me).mockResolvedValue(user)
    const request = renderHook(() => useRequestCode())
    const verify = renderHook(() => useVerifyCode())
    await act(() => request.result.current.mutateAsync('+49151'))
    let answer: User | undefined
    await act(async () => {
      answer = await verify.result.current.mutateAsync({ phoneNumber: '+49151', code: '123456' })
    })
    expect(api.auth.verify).toHaveBeenCalledWith('+49151', '123456')
    expect(answer).toEqual(user)
    expect(verify.client.getQueryData(queryKeys.me)).toEqual(user)
  })
})
