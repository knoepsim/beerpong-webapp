import { describe, expect, it } from 'vitest'
import { formatWhen } from './format-when'

const now = new Date(2026, 9, 14, 12, 0) // Mi., 14.10.2026

describe('formatWhen', () => {
  it('says today and tomorrow', () => {
    expect(formatWhen(new Date(2026, 9, 14, 20, 0).toISOString(), now)).toBe('heute, 20:00 Uhr')
    expect(formatWhen(new Date(2026, 9, 15, 9, 5).toISOString(), now)).toBe('morgen, 09:05 Uhr')
  })

  it('uses weekday and date further away, the year only for other years', () => {
    expect(formatWhen(new Date(2026, 9, 17, 18, 30).toISOString(), now)).toMatch(/^Sa\.?, 17\.10\., 18:30 Uhr$/)
    expect(formatWhen(new Date(2027, 0, 2, 18, 30).toISOString(), now)).toContain('2027')
  })

  it('does not call a past time today by mistake', () => {
    expect(formatWhen(new Date(2026, 9, 13, 20, 0).toISOString(), now)).not.toMatch(/^heute/)
  })
})
