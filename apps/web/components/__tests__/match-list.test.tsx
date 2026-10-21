import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MatchList } from '../match-list'
import { fiveTeamBracket, fiveTeams } from '@/lib/test-fixtures/bracket'

const finished = (winner: string, cups = 3) => ({ status: 'finished' as const, winner_team_id: winner, score_a: cups, score_b: 0 })

describe('MatchList', () => {
  it('lists every match grouped by round, byes are not matches', () => {
    render(<MatchList bracket={fiveTeamBracket()} teamsMap={fiveTeams} />)

    const sections = screen.getAllByRole('region')
    expect(sections.map((s) => s.getAttribute('aria-label'))).toEqual(['Viertelfinale', 'Halbfinale', 'Finale'])
    expect(within(sections[0]).getAllByRole('listitem')).toHaveLength(1)
    expect(within(sections[1]).getAllByRole('listitem')).toHaveLength(2)
    expect(within(sections[2]).getAllByRole('listitem')).toHaveLength(1)
  })

  it('shows results, the station of playable matches and the open sources', () => {
    render(<MatchList bracket={fiveTeamBracket({ m1: finished('t4', 6) })} teamsMap={fiveTeams} />)
    expect(screen.getByRole('article', { name: /Ergebnis 6:0/ })).toBeInTheDocument()
    expect(screen.getAllByText(/^Tisch \d$/)).toHaveLength(1) // only match 3 is ready
    expect(screen.getByText('Sieger Spiel 2')).toBeInTheDocument()
  })

  it('opens the organizer action on click and highlights the own team', () => {
    const onMatchClick = vi.fn()
    render(<MatchList bracket={fiveTeamBracket()} teamsMap={fiveTeams} onMatchClick={onMatchClick} highlightTeamId="t4" />)

    const mine = screen.getByRole('button', { name: /Spiel 1,/ })
    expect(screen.getByText('Team 4').closest('div')!.className).toContain('bg-primary/10')
    fireEvent.click(mine)
    expect(onMatchClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }))
  })
})
