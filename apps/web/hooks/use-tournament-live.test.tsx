import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTournamentLive } from './use-tournament-live'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { tournaments: { getState: vi.fn() } } }))

type Controller = ReadableStreamDefaultController<Uint8Array>
const encoder = new TextEncoder()

/** A stream the test feeds by hand, like the server does. */
const openStream = (signal?: AbortSignal) => {
  let controller!: Controller
  const body = new ReadableStream<Uint8Array>({ start: (c) => (controller = c) })
  // a real fetch closes the body with an error when its request is aborted
  signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
  return {
    response: new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    send: (text: string) => controller.enqueue(encoder.encode(text)),
    end: () => controller.close(),
  }
}
const revision = (n: number, changed: string[]) =>
  `event: revision\nid: ${n}\ndata: ${JSON.stringify({ revision: n, changed })}\n\n`

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0) // no wait before asking
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  vi.mocked(api.tournaments.getState).mockReset()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const setup = (props: { revision?: number } = {}) => {
  const onChange = vi.fn()
  const hook = renderHook(
    ({ revision }) => useTournamentLive({ tournamentId: 't1', revision, onChange }),
    { initialProps: { revision: props.revision ?? 5 } },
  )
  return { onChange, ...hook }
}

describe('useTournamentLive', () => {
  it('opens the stream of the tournament with the session cookie, and says it is live', async () => {
    const stream = openStream()
    fetchMock.mockResolvedValue(stream.response)

    const { result } = setup()
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/tournaments\/t1\/events$/)
    expect(init.credentials).toBe('include')
    expect(init.headers).toBeUndefined() // no token to send: the session is a cookie
    expect(result.current.status).toBe('live')
  })

  it('passes on what changed when the revision is newer', async () => {
    const stream = openStream()
    fetchMock.mockResolvedValue(stream.response)
    const { onChange } = setup({ revision: 5 })
    await flush()

    stream.send(revision(6, ['bracket', 'tournament']))
    await advance(1)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['tournament', 'bracket'])
  })

  it('ignores what the page already knows: the first message of a stream and its own actions', async () => {
    const stream = openStream()
    fetchMock.mockResolvedValue(stream.response)
    const { onChange } = setup({ revision: 5 })
    await flush()

    stream.send(revision(5, ['all'])) // the stream starts with the current revision
    stream.send(revision(4, ['teams']))
    await advance(1)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('loads everything when it missed something: the first message is newer than what the page shows', async () => {
    const stream = openStream()
    fetchMock.mockResolvedValue(stream.response)
    const { onChange } = setup({ revision: 5 })
    await flush()

    stream.send(revision(9, ['all']))
    await advance(1)

    expect(onChange).toHaveBeenCalledWith(['tournament', 'teams', 'bracket', 'roles'])
  })

  it('does not ask again for what the page loaded itself meanwhile', async () => {
    const stream = openStream()
    fetchMock.mockResolvedValue(stream.response)
    const { onChange, rerender } = setup({ revision: 5 })
    await flush()

    rerender({ revision: 7 }) // the page reloaded after an own action
    stream.send(revision(7, ['teams']))
    await advance(1)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('makes one request out of a burst of changes', async () => {
    const stream = openStream()
    fetchMock.mockResolvedValue(stream.response)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { onChange } = setup({ revision: 5 })
    await flush()

    stream.send(revision(6, ['teams']))
    await advance(100)
    stream.send(revision(7, ['bracket']))
    await advance(1000)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['teams', 'bracket'])
  })

  it('connects again, with growing pauses, and asks every 30 s once it cannot connect', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    vi.mocked(api.tournaments.getState).mockResolvedValue({ revision: 5 })
    const { result } = setup()

    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('connecting')
    await advance(1000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await advance(2000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.current.status).toBe('fallback')

    await advance(30_000)
    expect(api.tournaments.getState).toHaveBeenCalledWith('t1')
  })

  it('loads everything when the fallback sees a newer revision, and stops asking when the stream is back', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    vi.mocked(api.tournaments.getState).mockResolvedValue({ revision: 8 })
    const { onChange, result } = setup({ revision: 5 })
    await advance(3000)
    expect(result.current.status).toBe('fallback')

    await advance(31_000)
    expect(api.tournaments.getState).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith(['tournament', 'teams', 'bracket', 'roles'])

    fetchMock.mockResolvedValue(openStream().response)
    await advance(30_000) // the next connection attempt (the pauses grow up to 30 s)
    expect(result.current.status).toBe('live')
    vi.mocked(api.tournaments.getState).mockClear()
    await advance(60_000)
    expect(api.tournaments.getState).not.toHaveBeenCalled()
  })

  it('connects again right away when the server ends the stream', async () => {
    const first = openStream()
    fetchMock.mockResolvedValueOnce(first.response).mockResolvedValue(openStream().response)
    setup()
    await flush()

    first.end()
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('closes the stream after a minute in a hidden tab and opens it when the tab is back', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => openStream(init.signal!).response)
    const { result } = setup()
    await flush()
    const signal: AbortSignal = fetchMock.mock.calls[0][1].signal

    setVisibility('hidden')
    await advance(59_000)
    expect(signal.aborted).toBe(false)
    await advance(2000)
    expect(signal.aborted).toBe(true)
    expect(result.current.status).toBe('paused')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    setVisibility('visible')
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('live')
  })

  it('keeps the stream when the tab is only hidden for a moment', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => openStream(init.signal!).response)
    setup()
    await flush()
    const signal: AbortSignal = fetchMock.mock.calls[0][1].signal

    setVisibility('hidden')
    await advance(30_000)
    setVisibility('visible')
    await advance(60_000)

    expect(signal.aborted).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('closes the stream when the page is left', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => openStream(init.signal!).response)
    const { unmount } = setup()
    await flush()
    const signal: AbortSignal = fetchMock.mock.calls[0][1].signal

    unmount()

    expect(signal.aborted).toBe(true)
  })

  it('opens nothing without a tournament', async () => {
    renderHook(() => useTournamentLive({ tournamentId: undefined, revision: undefined, onChange: vi.fn() }))
    await flush()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
