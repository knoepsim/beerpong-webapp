import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MatchRow } from '../match-row'
import { abTeams as teamsMap, makeSlot as slot } from '@/lib/test-fixtures/bracket'

describe('MatchRow', () => {
  it('shows the number, both teams and, for a match that can be played, "Bereit" with the table', () => {
    render(<MatchRow slot={slot()} teamsMap={teamsMap} />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Bravo')).toBeInTheDocument()
    expect(screen.getByText('Bereit')).toBeInTheDocument()
    expect(screen.getByText('Tisch 1')).toBeInTheDocument()
  })

  it('shows the place in the queue of a match without a table', () => {
    render(<MatchRow slot={slot({ status: 'queued', table_id: null, table_name: null, queue_position: 1 })} teamsMap={teamsMap} />)
    expect(screen.getByTitle('Wartet auf Tisch, Platz 1 in der Warteschlange')).toHaveTextContent('Platz 1')
  })

  it('shows a waiting match as waiting, the rows name where the teams come from, no table', () => {
    const { container } = render(
      <MatchRow slot={slot({ status: 'waiting', team_a_id: null, team_b_id: null }, { a: 3, b: 4 })} teamsMap={teamsMap} />,
    )
    expect(screen.getByText('Sieger Spiel 3')).toBeInTheDocument()
    expect(screen.getByText('Sieger Spiel 4')).toBeInTheDocument()
    expect(screen.queryByText('Bereit')).not.toBeInTheDocument()
    expect(screen.getByTitle('Wartet auf Team')).toHaveTextContent('Wartet')
    expect(container.textContent).not.toMatch(/Tisch/)
  })

  it('shows every piece of information once: winner bold, loser dimmed and crossed out, cups, no table', () => {
    render(<MatchRow slot={slot({ status: 'finished', winner_team_id: 'b', cups_left: 4, table_id: 't3', table_name: 'Tisch 3' })} teamsMap={teamsMap} />)

    const winner = screen.getByText('Bravo').closest('div')!
    const loser = screen.getByText('Alpha').closest('div')!
    expect(winner.className).toContain('font-semibold')
    expect(winner.className).not.toContain('line-through')
    expect(loser.className).toContain('line-through')
    expect(loser.className).toContain('text-muted-foreground')

    expect(screen.getByText('4 Becher übrig')).toBeInTheDocument()
    expect(screen.queryByLabelText('Gewinner')).not.toBeInTheDocument() // no extra check mark
    expect(screen.queryByText(/Tisch/)).not.toBeInTheDocument()
    expect(screen.queryByText('Bereit')).not.toBeInTheDocument()
    expect(screen.queryByText('Beendet')).not.toBeInTheDocument()
  })

  it('shows nothing on the right when a finished match has no cups recorded', () => {
    render(<MatchRow slot={slot({ status: 'finished', winner_team_id: 'a' })} teamsMap={teamsMap} />)
    expect(screen.queryByText(/Becher/)).not.toBeInTheDocument()
  })

  it('colors the first team red and the second blue, and fades the stripe of the loser', () => {
    render(<MatchRow slot={slot({ status: 'finished', winner_team_id: 'a' })} teamsMap={teamsMap} />)
    expect(screen.getByText('Alpha').closest('div')!.className).toContain('border-l-red-500')
    expect(screen.getByText('Bravo').closest('div')!.className).toContain('border-l-blue-500/30')
  })

  it('highlights the own team without tinting the winner', () => {
    render(<MatchRow slot={slot({ status: 'finished', winner_team_id: 'a' })} teamsMap={teamsMap} highlightTeamId="b" />)
    expect(screen.getByText('Bravo').closest('div')!.className).toContain('bg-primary/10')
    expect(screen.getByText('Alpha').closest('div')!.className).not.toContain('bg-red-500/10')
  })

  it('describes the match for screen readers', () => {
    render(<MatchRow slot={slot({ status: 'finished', winner_team_id: 'a', cups_left: 2 })} teamsMap={teamsMap} />)
    expect(
      screen.getByRole('article', { name: 'Spiel 7, Alpha (rot) gegen Bravo (blau), beendet, Sieger Alpha, 2 Becher übrig' }),
    ).toBeInTheDocument()
  })

  it('opens the organizer action on click', () => {
    const onClick = vi.fn()
    render(<MatchRow slot={slot()} teamsMap={teamsMap} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: /Spiel 7/ }))
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'm' }))
  })

  it('is plain text without a handler', () => {
    render(<MatchRow slot={slot()} teamsMap={teamsMap} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
