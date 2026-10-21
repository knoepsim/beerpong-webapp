import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Schedule } from '../schedule'
import { fiveTeamBracket, fiveTeams } from '@/lib/test-fixtures/bracket'

const finished = { status: 'finished' as const, winner_team_id: 't4', score_a: 3, score_b: 0 }

describe('Schedule', () => {
  it('shows the tree first and switches to the list of open matches, finished ones on request', () => {
    render(<Schedule bracket={fiveTeamBracket({ m1: finished })} teamsMap={fiveTeams} />)
    expect(screen.getByRole('region', { name: 'Halbfinale' })).toBeInTheDocument() // the tree

    fireEvent.click(screen.getByRole('tab', { name: 'Liste' }))
    expect(screen.queryByRole('article', { name: /Ergebnis 3:0/ })).not.toBeInTheDocument()
    expect(screen.getByText('Team 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Beendete Spiele (1)' }))
    expect(screen.getByRole('article', { name: /Ergebnis 3:0/ })).toBeInTheDocument()
  })

  it('tells organizers what tapping a match does, players get no hint', () => {
    const { rerender } = render(<Schedule bracket={fiveTeamBracket()} teamsMap={fiveTeams} onMatchClick={vi.fn()} />)
    expect(screen.getByText(/Tippe auf ein Spiel/)).toBeInTheDocument()
    rerender(<Schedule bracket={fiveTeamBracket()} teamsMap={fiveTeams} />)
    expect(screen.queryByText(/Tippe auf ein Spiel/)).not.toBeInTheDocument()
  })
})
