import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeamDeleteBlockers } from '../delete-team-dialog'
import type { Team, TeamDeleteBlocker } from '@/types'

const team = (delete_blockers: TeamDeleteBlocker[]): Team =>
  ({ id: 't', name: 'Becherhelden', max_size: 2, members: [], is_complete: true, delete_blockers, created_at: '' }) as Team
const blocker = (overrides: Partial<TeamDeleteBlocker> = {}): TeamDeleteBlocker => ({
  tournament_name: 'Sommercup',
  tournament_slug: 'sommercup',
  running: false,
  registration_open: true,
  ...overrides,
})

describe('TeamDeleteBlockers', () => {
  it('says which tournaments stand in the way and how to get out, without a delete button', () => {
    render(
      <TeamDeleteBlockers
        team={team([blocker(), blocker({ tournament_name: 'Wintercup', tournament_slug: 'wintercup', running: true })])}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Becherhelden kann noch nicht gelöscht werden')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sommercup' })).toHaveAttribute('href', '/t/sommercup')
    expect(screen.getByText(/im Turnier mit „Turnier verlassen“ abmelden/)).toBeInTheDocument()
    expect(screen.getByText(/spielt gerade – Löschen geht nach dem Turnier/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /löschen/i })).not.toBeInTheDocument()
  })
})
