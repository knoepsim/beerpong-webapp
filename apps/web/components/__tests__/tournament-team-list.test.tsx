import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TournamentTeamList } from '../tournament-team-list'
import type { TournamentTeam } from '@/types'

const team = (id: string, checkedIn = false): TournamentTeam =>
  ({
    id,
    name: `Team ${id}`,
    is_checked_in: checkedIn,
    members: [
      { user_id: `${id}1`, name: `Anna ${id}` },
      { user_id: `${id}2`, name: `Ben ${id}` },
    ],
  }) as TournamentTeam

const setup = (props: Partial<React.ComponentProps<typeof TournamentTeamList>> = {}) => {
  const onCheckin = vi.fn()
  const onRemove = vi.fn()
  render(
    <TournamentTeamList
      teams={[team('A', true), team('B')]}
      showCheckin
      checkinOpen
      canManage={false}
      onCheckin={onCheckin}
      onRemove={onRemove}
      {...props}
    />,
  )
  return { onCheckin, onRemove }
}

describe('TournamentTeamList', () => {
  it('shows team name and players', () => {
    setup()
    expect(screen.getByText('Team A')).toBeInTheDocument()
    expect(screen.getByText('Anna A · Ben A')).toBeInTheDocument()
  })

  it('puts my team first and marks it', () => {
    setup({ myTeamId: 'B' })
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText('Team B')).toBeInTheDocument()
    expect(within(items[0]).getByText('Dein Team')).toBeInTheDocument()
  })

  it('shows participants only who is checked in, without actions', () => {
    setup()
    expect(screen.getAllByText('Eingecheckt')).toHaveLength(1)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows no check-in state when there is no check-in', () => {
    setup({ showCheckin: false })
    expect(screen.queryByText('Eingecheckt')).not.toBeInTheDocument()
  })

  it('lets organizers check in and out and remove teams', () => {
    const { onCheckin, onRemove } = setup({ canManage: true })
    fireEvent.click(screen.getByRole('button', { name: 'Team B einchecken' }))
    expect(onCheckin).toHaveBeenCalledWith(expect.objectContaining({ id: 'B' }), true)
    fireEvent.click(screen.getByRole('button', { name: /Team A ist eingecheckt/ }))
    expect(onCheckin).toHaveBeenCalledWith(expect.objectContaining({ id: 'A' }), false)
    fireEvent.click(screen.getByRole('button', { name: 'Team Team B entfernen' }))
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'B' }))
  })

  it('disables check-in until it is open', () => {
    setup({ canManage: true, checkinOpen: false })
    expect(screen.getByRole('button', { name: 'Team B einchecken' })).toBeDisabled()
  })
})
