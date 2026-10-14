import { describe, expect, it } from 'vitest'
import { toIsoOrNull, toLocalInput, validateSchedule, type ScheduleValues } from './tournament-schedule'

const base: ScheduleValues = {
  start_time: '2026-07-01T18:00',
  registration_end_time: '',
  checkin_enabled: false,
  checkin_start_time: '',
}

describe('validateSchedule', () => {
  it('accepts an empty and a complete, ordered schedule', () => {
    expect(validateSchedule(base)).toEqual({})
    expect(
      validateSchedule({
        ...base,
        registration_end_time: '2026-06-30T18:00',
        checkin_enabled: true,
        checkin_start_time: '2026-07-01T17:00',
      }),
    ).toEqual({})
  })

  it('rejects a registration deadline after the start', () => {
    const errors = validateSchedule({ ...base, registration_end_time: '2026-07-01T19:00' })
    expect(errors.registration_end_time).toMatch(/vor dem Turnierstart/)
  })

  it('rejects a check-in after the start', () => {
    const errors = validateSchedule({ ...base, checkin_enabled: true, checkin_start_time: '2026-07-01T19:00' })
    expect(errors.checkin_start_time).toMatch(/vor dem Turnierstart/)
  })

  it('rejects a check-in that opens before the registration closes', () => {
    const errors = validateSchedule({
      ...base,
      registration_end_time: '2026-07-01T17:00',
      checkin_enabled: true,
      checkin_start_time: '2026-07-01T16:00',
    })
    expect(errors.checkin_start_time).toMatch(/nach dem Anmeldeschluss/)
  })

  it('ignores the check-in time while check-in is off', () => {
    expect(validateSchedule({ ...base, checkin_start_time: '2026-07-02T18:00' })).toEqual({})
  })
})

describe('time conversion', () => {
  it('round-trips between the API and datetime-local inputs', () => {
    const iso = new Date('2026-07-01T18:30').toISOString()
    expect(toLocalInput(iso)).toBe('2026-07-01T18:30')
    expect(toIsoOrNull('2026-07-01T18:30')).toBe(iso)
  })

  it('treats missing values as empty', () => {
    expect(toLocalInput(null)).toBe('')
    expect(toIsoOrNull('')).toBeNull()
  })
})
