import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VisibilitySelect } from '../visibility-select'
import { VISIBILITY_OPTIONS, visibilityLabel } from '@/lib/tournament-visibility'
import { TournamentVisibility } from '@/types'

describe('VisibilitySelect', () => {
  it('shows the name of the chosen option in the field, not its value', () => {
    render(<VisibilitySelect value={TournamentVisibility.PUBLIC_UNLISTED} onChange={() => {}} />)
    const trigger = screen.getByRole('combobox', { name: 'Sichtbarkeit' })
    expect(trigger).toHaveTextContent('Nur mit Link')
    expect(trigger).not.toHaveTextContent('public_unlisted')
  })

  it('explains the chosen option below the field', () => {
    render(<VisibilitySelect value={TournamentVisibility.PRIVATE} onChange={() => {}} />)
    expect(screen.getAllByText(VISIBILITY_OPTIONS[2].description).length).toBeGreaterThan(0)
  })
})

describe('visibility options', () => {
  it('has one distinct name and explanation per option', () => {
    expect(new Set(VISIBILITY_OPTIONS.map((o) => o.label)).size).toBe(3)
    expect(new Set(VISIBILITY_OPTIONS.map((o) => o.description)).size).toBe(3)
    expect(new Set(VISIBILITY_OPTIONS.map((o) => o.summary)).size).toBe(3)
    expect(visibilityLabel(TournamentVisibility.PRIVATE)).toBe('Privat')
  })
})
