import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PodiumCard } from '../podium-card'
import { fiveTeamBracket, fiveTeams } from '@/lib/test-fixtures/bracket'

// the confetti has its own test (a canvas, which jsdom cannot draw)
vi.mock('../celebration', () => ({ Celebration: () => null }))

const won = (winner: string) => ({ status: 'finished' as const, winner_team_id: winner, cups_left: 2 })

describe('PodiumCard', () => {
  it('shows the winner and the other places once the final is played', () => {
    const bracket = {
      ...fiveTeamBracket({
        m1: won('t4'),
        m2: { team_b_id: 't4', ...won('t1') },
        m3: won('t3'),
        m4: { team_a_id: 't1', team_b_id: 't3', ...won('t3') },
      }),
      champion_team_id: 't3',
    }
    render(<PodiumCard bracket={bracket} teamsMap={fiveTeams} />)
    expect(screen.getByText('Turniersieger')).toBeInTheDocument()
    expect(screen.getByText('Team 3')).toBeInTheDocument()
    expect(screen.getByText('Team 1')).toBeInTheDocument()
    expect(screen.getByText('Team 4 · Team 2')).toBeInTheDocument()
  })

  it('is not there before the end', () => {
    const { container } = render(<PodiumCard bracket={fiveTeamBracket()} teamsMap={fiveTeams} />)
    expect(container).toBeEmptyDOMElement()
  })
})
