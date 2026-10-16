import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DeleteTeamDialog } from '../delete-team-dialog'
import type { Team, TeamDeleteBlocker } from '@/types'

const team = (delete_blockers: TeamDeleteBlocker[] = []): Team =>
  ({ id: 't', name: 'Becherhelden', max_size: 2, members: [], is_complete: true, delete_blockers, created_at: '' }) as Team
const blocker = (overrides: Partial<TeamDeleteBlocker> = {}): TeamDeleteBlocker => ({
  tournament_name: 'Sommercup',
  tournament_slug: 'sommercup',
  running: false,
  registration_open: true,
  ...overrides,
})

describe('DeleteTeamDialog', () => {
  it('names the consequences and deletes on confirmation', () => {
    const onDelete = vi.fn()
    render(<DeleteTeamDialog team={team()} isDeleting={false} onClose={vi.fn()} onDelete={onDelete} />)

    expect(screen.getByText('Becherhelden löschen?')).toBeInTheDocument()
    expect(screen.getByText(/Beendete Turniere zeigen es weiter/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Team löschen' }))
    expect(onDelete).toHaveBeenCalled()
  })

  it('says which tournaments stand in the way and how to get out, without a delete button', () => {
    render(
      <DeleteTeamDialog
        team={team([blocker(), blocker({ tournament_name: 'Wintercup', tournament_slug: 'wintercup', running: true })])}
        isDeleting={false}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText('Becherhelden kann noch nicht gelöscht werden')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sommercup' })).toHaveAttribute('href', '/t/sommercup')
    expect(screen.getByText(/im Turnier mit „Turnier verlassen“ abmelden/)).toBeInTheDocument()
    expect(screen.getByText(/spielt gerade – Löschen geht nach dem Turnier/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Team löschen' })).not.toBeInTheDocument()
  })
})
