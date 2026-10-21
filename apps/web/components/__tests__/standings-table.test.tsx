import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { render } from '@/lib/test-fixtures/render'
import { StandingsTable } from '../standings-table'
import { abcTeams, roundRobinBracket } from '@/lib/test-fixtures/bracket'
import { Game } from '@/types'

describe('StandingsTable', () => {
  const standings = roundRobinBracket().standings!

  it('shows rank, team, matches and points, my team highlighted', () => {
    render(<StandingsTable standings={standings} teamsMap={abcTeams} highlightTeamId="b" />, { game: Game.BEERPONG })
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getAllByRole('cell')[1].textContent)).toEqual(['Alpha', 'Charlie', 'Bravo'])
    expect(within(rows[0]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1.', 'Alpha', '1', '1', '0', '+3', '3'])
    expect(rows[2]).toHaveAttribute('aria-current', 'true')
    expect(screen.queryByTitle('Unentschieden')).not.toBeInTheDocument() // beer pong has no draws
  })

  it('has a column for draws where the game has them', () => {
    render(<StandingsTable standings={standings} teamsMap={abcTeams} />, { game: Game.FOOTBALL })
    expect(screen.getByTitle('Unentschieden')).toBeInTheDocument()
  })
})
