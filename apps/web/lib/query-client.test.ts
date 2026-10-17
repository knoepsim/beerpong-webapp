import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, NetworkError } from '@/lib/api'
import { makeQueryClient, shouldRetry, successMessage } from '@/lib/query-client'
import { errorMessage, GENERIC_ERROR, notifyError } from '@/lib/errors'
import { queryKeys, tournamentKeys } from '@/lib/query-keys'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

beforeEach(() => vi.clearAllMocks())

/** Runs a mutation through the cache of the client, as useMutation does. */
const mutate = (options: Record<string, unknown>, client = makeQueryClient()) =>
  client.getMutationCache().build(client, options as never).execute(undefined as never)

describe('shouldRetry', () => {
  it('does not ask again what the server refused', () => {
    expect(shouldRetry(0, new ApiError(404, {}))).toBe(false)
    expect(shouldRetry(0, new ApiError(403, {}))).toBe(false)
  })

  it('asks again twice after a hiccup', () => {
    expect(shouldRetry(0, new NetworkError())).toBe(true)
    expect(shouldRetry(1, new ApiError(503, {}))).toBe(true)
    expect(shouldRetry(2, new ApiError(503, {}))).toBe(false)
  })
})

describe('mutations', () => {
  it('say their success, with the answer and the variables', async () => {
    await mutate({
      mutationFn: async () => ({ name: 'Becherhelden' }),
      meta: { successMessage: successMessage((team: { name: string }) => `${team.name} gegründet.`) },
    })
    expect(toast.success).toHaveBeenCalledWith('Becherhelden gegründet.')
  })

  it('show an error as a toast in the words of the API', async () => {
    await mutate({ mutationFn: () => Promise.reject(new ApiError(409, { detail: 'Schon vergeben.' })) }).catch(() => {})
    expect(toast.error).toHaveBeenCalledWith('Schon vergeben.')
  })

  it('leave an error to the form that shows it at its field', async () => {
    const slugError = new ApiError(409, { detail: 'Adresse vergeben.' })
    await mutate({ mutationFn: () => Promise.reject(slugError), meta: { inlineError: true } }).catch(() => {})
    await mutate({
      mutationFn: () => Promise.reject(slugError),
      meta: { inlineError: (error: Error) => error === slugError },
    }).catch(() => {})
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('load again what they made stale before they count as done, also after an error', async () => {
    const client = makeQueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await mutate({ mutationFn: async () => 1, meta: { invalidates: [queryKeys.teams] } }, client)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.teams })

    invalidate.mockClear()
    await mutate({ mutationFn: () => Promise.reject(new Error('x')), meta: { invalidates: [queryKeys.teams] } }, client).catch(() => {})
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.teams })
  })
})

describe('queries', () => {
  it('say a failed refresh, not a failed first load (the screen shows that itself)', async () => {
    const client = makeQueryClient()
    const fail = () => Promise.reject(new ApiError(500, { detail: 'Server hat ein Problem.' }))
    await client.fetchQuery({ queryKey: ['x'], queryFn: fail, retry: false }).catch(() => {})
    expect(toast.error).not.toHaveBeenCalled()

    client.setQueryData(['y'], 1)
    await client.fetchQuery({ queryKey: ['y'], queryFn: fail, retry: false, staleTime: 0 }).catch(() => {})
    expect(toast.error).toHaveBeenCalledWith('Server hat ein Problem.')
  })
})

describe('errors', () => {
  it('use the words of the API, a general sentence for anything else', () => {
    expect(errorMessage(new ApiError(400, { detail: 'Name fehlt.' }))).toBe('Name fehlt.')
    expect(errorMessage(new NetworkError())).toMatch(/Keine Verbindung/)
    expect(errorMessage(new TypeError('Failed to fetch'))).toBe(GENERIC_ERROR)
    expect(errorMessage('x', 'Eigener Text.')).toBe('Eigener Text.')
  })

  it('are said once', () => {
    const error = new ApiError(409, { detail: 'Einmal.' })
    notifyError(error)
    notifyError(error)
    expect(toast.error).toHaveBeenCalledTimes(1)
  })
})

describe('tournamentKeys', () => {
  it('names what a changed part makes stale, "Meine Turniere" included', () => {
    expect(tournamentKeys('t1', ['bracket'])).toEqual([
      queryKeys.bracket('t1'),
      queryKeys.tournamentTables('t1'),
      queryKeys.results,
      queryKeys.myTournaments,
    ])
    expect(tournamentKeys('t1', ['tournament', 'roles'])).toEqual([
      queryKeys.tournamentLookups,
      queryKeys.myTournaments,
      queryKeys.tournamentRoles('t1'),
      queryKeys.myTournaments,
    ])
  })

  it('reaches the lookup of a tournament by its address', () => {
    expect(queryKeys.tournamentBySlug('cup').slice(0, 2)).toEqual([...queryKeys.tournamentLookups])
  })
})
