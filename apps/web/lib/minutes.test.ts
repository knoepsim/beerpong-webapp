import { describe, expect, it } from 'vitest'
import { sinceLabel } from './minutes'

const NOW = new Date('2026-10-17T12:00:00Z')
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString()

describe('sinceLabel', () => {
  it('says minutes, and hours with minutes once it is long', () => {
    expect(sinceLabel(ago(0), NOW)).toBe('gerade eben')
    expect(sinceLabel(ago(8), NOW)).toBe('seit 8 Min.')
    expect(sinceLabel(ago(120), NOW)).toBe('seit 2 Std.')
    expect(sinceLabel(ago(817), NOW)).toBe('seit 13 Std. 37 Min.')
  })
})
