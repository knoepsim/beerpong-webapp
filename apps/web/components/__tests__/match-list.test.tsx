import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MatchList } from '../match-list'
import { MyMatches } from '../my-matches'
import { fiveTeamBracket, fiveTeams } from '@/lib/test-fixtures/bracket'

const finished = (winner: string, cups = 3) => ({ status: 'finished' as const, winner_team_id: winner, cups_left: cups })

describe('MatchList', () => {
  it('lists every match grouped by round, byes are not matches', () => {
    render(<MatchList bracket={fiveTeamBracket()} teamsMap={fiveTeams} />)

    const sections = screen.getAllByRole('region')
    expect(sections.map((s) => s.getAttribute('aria-label'))).toEqual(['Viertelfinale', 'Halbfinale', 'Finale'])
    expect(within(sections[0]).getAllByRole('listitem')).toHaveLength(1)
    expect(within(sections[1]).getAllByRole('listitem')).toHaveLength(2)
    expect(within(sections[2]).getAllByRole('listitem')).toHaveLength(1)
  })

  it('shows results, tables and open sources like the bracket', () => {
    render(<MatchList bracket={fiveTeamBracket({ m1: finished('t4', 6) })} teamsMap={fiveTeams} />)
    expect(screen.getByText('6 Becher')).toBeInTheDocument()
    expect(screen.getAllByText(/Tisch folgt/).length).toBeGreaterThan(0)
    expect(screen.getByText('Sieger Spiel 2')).toBeInTheDocument()
  })

  it('opens the organizer action on click and highlights the own team', () => {
    const onMatchClick = vi.fn()
    render(<MatchList bracket={fiveTeamBracket()} teamsMap={fiveTeams} onMatchClick={onMatchClick} highlightTeamId="t4" />)

    const mine = screen.getByRole('button', { name: /Spiel 1,/ })
    expect(mine.className).toContain('ring-primary')
    fireEvent.click(mine)
    expect(onMatchClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }))
  })
})

describe('MyMatches', () => {
  const props = { teamsMap: fiveTeams, location: 'Garten' }

  it('shows the matches my team is placed in that are not played yet, with the venue', () => {
    // T1 got a bye and waits in the semi-final for the winner of match 1
    render(<MyMatches {...props} bracket={fiveTeamBracket()} teamId="t1" />)

    expect(screen.getByText('Garten')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('group', { name: /Spiel 2,/ })).toBeInTheDocument()
    expect(screen.getByText('Halbfinale')).toBeInTheDocument()
    expect(screen.getByText(/Tisch folgt/)).toBeInTheDocument()
  })

  it('shows nothing from the past', () => {
    // T4 played and won match 1, T5 lost it; match 1 must not show up for either
    const bracket = fiveTeamBracket({ m1: finished('t4') })
    const { rerender } = render(<MyMatches {...props} bracket={bracket} teamId="t4" />)
    expect(screen.queryByRole('group', { name: /Spiel 1,/ })).not.toBeInTheDocument()

    rerender(<MyMatches {...props} bracket={bracket} teamId="t5" />)
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('tells a team that is out that it is out', () => {
    render(<MyMatches {...props} bracket={fiveTeamBracket({ m1: finished('t4') })} teamId="t5" />)
    expect(screen.getByText(/ausgeschieden/)).toBeInTheDocument()
  })

  it('congratulates the champion', () => {
    const bracket = {
      ...fiveTeamBracket({
        m1: finished('t4'),
        m2: { team_b_id: 't4', ...finished('t1') },
        m3: finished('t2'),
        m4: { team_a_id: 't1', team_b_id: 't2', ...finished('t1') },
      }),
      champion_team_id: 't1',
    }
    render(<MyMatches {...props} bracket={bracket} teamId="t1" />)
    expect(screen.getByText(/gewonnen/)).toBeInTheDocument()
  })

  it('says so when nothing is planned and works without a venue', () => {
    render(<MyMatches teamsMap={fiveTeams} bracket={fiveTeamBracket()} teamId="nobody" />)
    expect(screen.getByText(/keine weiteren Spiele/)).toBeInTheDocument()
    expect(screen.queryByText('Ort:')).not.toBeInTheDocument()
  })

  it('opens the organizer action on click', () => {
    const onMatchClick = vi.fn()
    render(<MyMatches {...props} bracket={fiveTeamBracket()} teamId="t4" onMatchClick={onMatchClick} />)
    fireEvent.click(screen.getByRole('button', { name: /Spiel 1,/ }))
    expect(onMatchClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }))
  })
})
