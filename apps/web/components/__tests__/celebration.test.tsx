import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { forwardRef, useImperativeHandle } from 'react'
import { Celebration } from '../celebration'

const fire = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/confetti', () => ({
  Confetti: forwardRef(function Confetti(_props, ref) {
    useImperativeHandle(ref, () => ({ fire }))
    return <canvas data-testid="confetti" />
  }),
}))

const reduceMotion = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce') }))

beforeEach(() => {
  fire.mockClear()
  localStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('Celebration', () => {
  it('celebrates the winner once per tournament', () => {
    reduceMotion(false)
    const { unmount } = render(<Celebration id="t1" />)
    expect(fire).toHaveBeenCalled()
    unmount()
    fire.mockClear()

    const again = render(<Celebration id="t1" />)
    expect(again.queryByTestId('confetti')).toBeNull()
    expect(fire).not.toHaveBeenCalled()
  })

  it('stays still for somebody who asked for less motion', () => {
    reduceMotion(true)
    const { queryByTestId } = render(<Celebration id="t2" />)
    expect(queryByTestId('confetti')).toBeNull()
    expect(fire).not.toHaveBeenCalled()
  })
})
