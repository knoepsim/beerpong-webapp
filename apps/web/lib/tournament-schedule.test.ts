import { describe, expect, it } from 'vitest'
import { scheduleToPayload, toIsoOrNull, toLocalInput, validateSchedule, type ScheduleValues } from './tournament-schedule'

const base: ScheduleValues = {
  start_time: '2026-07-01T18:00',
  registration_end_time: '',
  registration_auto_close: false,
  checkin_enabled: false,
  checkin_start_time: '',
  checkin_auto_open: false,
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

  it('lets check-in open before the registration closes: late teams can still register', () => {
    expect(
      validateSchedule({
        ...base,
        registration_end_time: '2026-07-01T17:00',
        checkin_enabled: true,
        checkin_start_time: '2026-07-01T16:00',
      }),
    ).toEqual({})
  })

  it('ignores the check-in time while check-in is off', () => {
    expect(validateSchedule({ ...base, checkin_start_time: '2026-07-02T18:00' })).toEqual({})
  })
})

describe('scheduleToPayload', () => {
  it('sends the times with their automation', () => {
    expect(
      scheduleToPayload({
        ...base,
        registration_end_time: '2026-06-30T18:00',
        registration_auto_close: true,
        checkin_enabled: true,
        checkin_start_time: '2026-07-01T17:00',
        checkin_auto_open: true,
      }),
    ).toEqual({
      registration_end_time: new Date('2026-06-30T18:00').toISOString(),
      registration_auto_close: true,
      checkin_enabled: true,
      checkin_start_time: new Date('2026-07-01T17:00').toISOString(),
      checkin_auto_open: true,
    })
  })

  it('never automates without a time or without check-in', () => {
    expect(
      scheduleToPayload({ ...base, registration_auto_close: true, checkin_auto_open: true, checkin_start_time: '2026-07-01T17:00' }),
    ).toEqual({
      registration_end_time: null,
      registration_auto_close: false,
      checkin_enabled: false,
      checkin_start_time: null,
      checkin_auto_open: false,
    })
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
