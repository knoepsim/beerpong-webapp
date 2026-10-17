import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ParticipantStatus } from '../participant-status'
import { fiveTeamBracket, fiveTeams } from '@/lib/test-fixtures/bracket'
import { makeTournament as tournament, makeTournamentTeam as team } from '@/lib/test-fixtures/tournament'
import { JoinPolicy } from '@/types'

vi.mock('@/components/join-tournament', () => ({ JoinTournament: () => <button type="button">Mit Team beitreten</button> }))

const base = { teamsMap: fiveTeams, canManage: false, slug: 'cup', onJoined: vi.fn(), onLeave: vi.fn(), bracket: null }

describe('ParticipantStatus', () => {
  it('lets a registered team leave only while the registration is open', () => {
    const onLeave = vi.fn()
    const { rerender } = render(<ParticipantStatus {...base} tournament={tournament()} team={team()} onLeave={onLeave} />)

    expect(screen.getByRole('status')).toHaveTextContent('Team 4 ist angemeldet.')
    fireEvent.click(screen.getByRole('button', { name: 'Turnier verlassen' }))
    expect(onLeave).toHaveBeenCalled()

    rerender(<ParticipantStatus {...base} tournament={tournament({ registration_open: false })} team={team()} />)
    expect(screen.queryByRole('button', { name: 'Turnier verlassen' })).not.toBeInTheDocument()
  })

  it('shows the sentence and the match of a running tournament', () => {
    render(
      <ParticipantStatus
        {...base}
        tournament={tournament({ started_at: '2099-07-01T18:00:00Z', registration_open: false, phase: 'running' })}
        team={team()}
        bracket={fiveTeamBracket()}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Geh jetzt zu Tisch 1: Spiel gegen Team 5.')
    expect(screen.getByRole('article', { name: /Spiel 1,/ })).toBeInTheDocument()
  })

  it('invites to join while the registration is open, or explains the invitation link', () => {
    const { rerender } = render(<ParticipantStatus {...base} tournament={tournament()} team={null} />)
    expect(screen.getByRole('status')).toHaveTextContent('Die Anmeldung ist offen.')
    expect(screen.getByRole('button', { name: 'Mit Team beitreten' })).toBeInTheDocument()

    rerender(<ParticipantStatus {...base} tournament={tournament({ join_policy: JoinPolicy.INVITE_ONLY })} team={null} />)
    expect(screen.getByText(/nur mit einem Einladungslink/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mit Team beitreten' })).not.toBeInTheDocument()
  })

  it('shows nothing to organizers without a team or when the registration is closed', () => {
    const { container, rerender } = render(<ParticipantStatus {...base} tournament={tournament()} team={null} canManage />)
    expect(container).toBeEmptyDOMElement()
    rerender(<ParticipantStatus {...base} tournament={tournament({ registration_open: false })} team={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ParticipantStatus: one line on the other tabs', () => {
  it('keeps the sentence, leaves out the match and the actions', () => {
    render(
      <ParticipantStatus
        {...base}
        tournament={tournament({ started_at: '2099-07-01T18:00:00Z', registration_open: false, phase: 'running' })}
        team={team()}
        bracket={fiveTeamBracket()}
        compact
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Geh jetzt zu Tisch 1: Spiel gegen Team 5.')
    expect(screen.queryByRole('article', { name: /Spiel 1,/ })).not.toBeInTheDocument()
  })
})
