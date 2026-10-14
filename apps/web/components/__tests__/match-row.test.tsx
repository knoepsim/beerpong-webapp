import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MatchRow } from '../match-row'
import { makeMatch } from '@/lib/test-fixtures/bracket'
import type { MatchSlot } from '@/lib/bracket-layout'
import type { Match, Team } from '@/types'

const teamsMap: Record<string, Team> = {
  a: { id: 'a', name: 'Alpha' } as Team,
  b: { id: 'b', name: 'Bravo' } as Team,
}

const slot = (overrides: Partial<Match> = {}, sources: MatchSlot['sources'] = { a: null, b: null }): MatchSlot => ({
  kind: 'match',
  number: 7,
  sources,
  match: makeMatch({ id: 'm', round: 1, position: 0, team_a_id: 'a', team_b_id: 'b', status: 'ready', ...overrides }),
})

describe('MatchRow', () => {
  it('shows number, table and status in one line above both teams', () => {
    render(<MatchRow slot={slot()} teamsMap={teamsMap} />)
    expect(screen.getByText('Spiel 7 · Tisch folgt')).toBeInTheDocument()
    expect(screen.getByText('Bereit')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Bravo')).toBeInTheDocument()
  })

  it('shows an assigned table', () => {
    render(<MatchRow slot={slot({ table_number: 2 })} teamsMap={teamsMap} />)
    expect(screen.getByText('Spiel 7 · Tisch 2')).toBeInTheDocument()
  })

  it('colors the first team red and the second blue', () => {
    render(<MatchRow slot={slot()} teamsMap={teamsMap} />)
    expect(screen.getByText('Alpha').closest('div')!.className).toContain('border-l-red-500')
    expect(screen.getByText('Bravo').closest('div')!.className).toContain('border-l-blue-500')
  })

  it('shows the result: winner with a check, loser disabled and crossed out, cups in the corner', () => {
    render(<MatchRow slot={slot({ status: 'finished', winner_team_id: 'b', cups_left: 4 })} teamsMap={teamsMap} />)

    expect(screen.getByText('4 Becher')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Gewinner')).toHaveLength(1)
    const winner = screen.getByText('Bravo').closest('div')!
    const loser = screen.getByText('Alpha').closest('div')!
    expect(winner).toContainElement(screen.getByLabelText('Gewinner'))
    expect(winner.className).not.toContain('line-through')
    expect(loser.className).toContain('line-through')
    expect(loser.className).toContain('text-muted-foreground')
    expect(loser.className).toContain('border-l-red-500/30') // faded stripe
  })

  it('names the missing teams of a waiting match', () => {
    render(<MatchRow slot={slot({ status: 'waiting', team_a_id: null, team_b_id: null }, { a: 3, b: 4 })} teamsMap={teamsMap} />)
    expect(screen.getByText('Sieger Spiel 3')).toBeInTheDocument()
    expect(screen.getByText('Sieger Spiel 4')).toBeInTheDocument()
    expect(screen.getByText('Wartet')).toBeInTheDocument()
  })

  it('highlights the own team', () => {
    render(<MatchRow slot={slot()} teamsMap={teamsMap} highlightTeamId="b" />)
    expect(screen.getByRole('group').className).toContain('ring-primary')
    expect(screen.getByText('Bravo').closest('div')!.className).toContain('bg-primary/10')
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
