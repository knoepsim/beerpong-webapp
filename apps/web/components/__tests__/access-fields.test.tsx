import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccessFields } from '../access-fields'
import { JOIN_OPTIONS, VISIBILITY_OPTIONS, optionLabel } from '@/lib/tournament-access'
import { JoinPolicy, TournamentVisibility } from '@/types'

describe('AccessFields', () => {
  it('shows the names of the chosen options in the fields, not their values', () => {
    render(
      <AccessFields
        values={{ visibility: TournamentVisibility.PRIVATE, join_policy: JoinPolicy.INVITE_ONLY }}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('combobox', { name: 'Ergebnisse sehen' })).toHaveTextContent('Privat')
    expect(screen.getByRole('combobox', { name: 'Beitreten' })).toHaveTextContent('Nur mit Einladungslink')
    expect(screen.getByRole('combobox', { name: 'Beitreten' })).not.toHaveTextContent('invite_only')
  })

  it('explains the chosen options below the fields', () => {
    render(
      <AccessFields
        values={{ visibility: TournamentVisibility.PUBLIC, join_policy: JoinPolicy.OPEN }}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(VISIBILITY_OPTIONS[0].description)).toBeInTheDocument()
    expect(screen.getByText(JOIN_OPTIONS[0].description)).toBeInTheDocument()
  })
})

describe('access options', () => {
  it('have distinct names, summaries and explanations', () => {
    for (const options of [VISIBILITY_OPTIONS, JOIN_OPTIONS]) {
      for (const key of ['label', 'summary', 'description'] as const) {
        expect(new Set(options.map((o) => o[key])).size).toBe(options.length)
      }
    }
    expect(optionLabel(VISIBILITY_OPTIONS, TournamentVisibility.PUBLIC)).toBe('Öffentlich')
  })
})
