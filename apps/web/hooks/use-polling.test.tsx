import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePolling } from './use-polling'

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})
afterEach(() => vi.useRealTimers())

describe('usePolling', () => {
  it('calls the callback on every interval while the page is visible', () => {
    const callback = vi.fn()
    renderHook(() => usePolling(callback, 1000))
    vi.advanceTimersByTime(3000)
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('does nothing while the page is hidden and catches up when it is visible again', () => {
    const callback = vi.fn()
    renderHook(() => usePolling(callback, 1000))
    setVisibility('hidden')
    callback.mockClear()
    vi.advanceTimersByTime(5000)
    expect(callback).not.toHaveBeenCalled()

    setVisibility('visible')
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('stops after unmount and always calls the latest callback', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender, unmount } = renderHook(({ cb }) => usePolling(cb, 1000), { initialProps: { cb: first } })
    rerender({ cb: second })
    vi.advanceTimersByTime(1000)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)

    unmount()
    vi.advanceTimersByTime(5000)
    expect(second).toHaveBeenCalledTimes(1)
  })
})
