import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { checkinNote, PreparationControls, registrationNote } from '../preparation-controls'
import type { Tournament } from '@/types'

const tournament = (overrides: Partial<Tournament> = {}): Tournament =>
  ({
    registration_open: true,
    registration_end_time: null,
    registration_auto_close: false,
    checkin_enabled: true,
    checkin_open: false,
    checkin_start_time: null,
    checkin_auto_open: false,
    ...overrides,
  }) as Tournament

const setup = (t: Tournament) => {
  const onRegistration = vi.fn()
  const onCheckin = vi.fn()
  render(<PreparationControls tournament={t} onRegistration={onRegistration} onCheckin={onCheckin} />)
  return { onRegistration, onCheckin }
}

describe('PreparationControls', () => {
  it('switches registration and check-in independently', () => {
    const { onRegistration, onCheckin } = setup(tournament())
    fireEvent.click(screen.getByRole('button', { name: 'Anmeldung schließen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check-in öffnen' }))
    expect(onRegistration).toHaveBeenCalledWith(false)
    expect(onCheckin).toHaveBeenCalledWith(true)
  })

  it('offers reopening a closed registration, also while check-in is open', () => {
    const { onRegistration } = setup(tournament({ registration_open: false, checkin_open: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Anmeldung öffnen' }))
    expect(onRegistration).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: 'Check-in schließen' })).toBeInTheDocument()
  })

  it('has no check-in row without check-in', () => {
    setup(tournament({ checkin_enabled: false }))
    expect(screen.queryByText('Check-in')).not.toBeInTheDocument()
  })

  it('shows the state of both at the same time', () => {
    setup(tournament({ checkin_open: true }))
    expect(screen.getAllByText(/^Offen/)).toHaveLength(2)
  })
})

describe('automation notes', () => {
  const now = new Date(2026, 9, 14, 12, 0)
  const later = new Date(2026, 9, 14, 20, 0).toISOString()
  const earlier = new Date(2026, 9, 14, 8, 0).toISOString()

  it('names the next automatic switch while it is ahead', () => {
    expect(registrationNote(tournament({ registration_end_time: later, registration_auto_close: true }), now)).toBe(
      'schließt heute, 20:00 Uhr',
    )
    expect(checkinNote(tournament({ checkin_start_time: later, checkin_auto_open: true }), now)).toBe(
      'öffnet heute, 20:00 Uhr',
    )
  })

  it('says nothing without automation, after its time, or when the switch already has that state', () => {
    expect(registrationNote(tournament({ registration_end_time: later }), now)).toBeUndefined()
    expect(registrationNote(tournament({ registration_end_time: earlier, registration_auto_close: true }), now)).toBeUndefined()
    expect(registrationNote(tournament({ registration_open: false, registration_end_time: later, registration_auto_close: true }), now)).toBeUndefined()
    expect(checkinNote(tournament({ checkin_open: true, checkin_start_time: later, checkin_auto_open: true }), now)).toBeUndefined()
  })
})
