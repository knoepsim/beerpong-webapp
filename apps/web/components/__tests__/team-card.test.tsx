import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TeamCard } from '../team-card'
import type { Team } from '@/types'

const team = (members: string[]): Team =>
  ({
    id: 't',
    name: 'Becherhelden',
    max_size: 2,
    members: members.map((name, i) => ({ user_id: `${i}`, name })),
    is_complete: members.length === 2,
    delete_blockers: [],
    created_at: '',
  }) as unknown as Team

const handlers = () => ({ onRename: vi.fn(), onDelete: vi.fn(), onShare: vi.fn(), onCopy: vi.fn() })

describe('TeamCard', () => {
  it('shows name and players', () => {
    render(<TeamCard team={team(['Anna', 'Ben'])} {...handlers()} />)
    expect(screen.getByRole('heading', { name: 'Becherhelden' })).toBeInTheDocument()
    expect(screen.getByText('Anna · Ben')).toBeInTheDocument()
  })

  it('offers the invitation only while a player is missing', () => {
    const { rerender } = render(<TeamCard team={team(['Anna'])} {...handlers()} />)
    expect(screen.getByText('Dir fehlt noch ein Mitspieler.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Einladen/ })).toBeInTheDocument()

    rerender(<TeamCard team={team(['Anna', 'Ben'])} {...handlers()} />)
    expect(screen.queryByRole('button', { name: /Einladen/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/fehlt/)).not.toBeInTheDocument()
  })

  it('shares and copies the invitation', () => {
    const h = handlers()
    render(<TeamCard team={team(['Anna'])} {...h} />)
    fireEvent.click(screen.getByRole('button', { name: /Einladen/ }))
    fireEvent.click(screen.getByRole('button', { name: /Link kopieren/ }))
    expect(h.onShare).toHaveBeenCalledOnce()
    expect(h.onCopy).toHaveBeenCalledOnce()
  })
})
