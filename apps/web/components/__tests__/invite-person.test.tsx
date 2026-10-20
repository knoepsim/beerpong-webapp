import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { render } from '@/lib/test-fixtures/render'
import { InvitePerson } from '../invite-person'
import { InvitationsPanel } from '../invitations-panel'
import { InvitationItem } from '../invitation-item'
import { api } from '@/lib/api'
import { JoinPolicy, type Invitation, type TournamentInvitation } from '@/types'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: {
    users: { search: vi.fn() },
    tournaments: { listInvitations: vi.fn(), invitePerson: vi.fn(), withdrawInvitation: vi.fn(), listInvites: vi.fn() },
  },
}))

const t = vi.mocked(api.tournaments)

const invitation = (overrides: Partial<TournamentInvitation> = {}): TournamentInvitation => ({
  id: 'p1',
  user_id: 'u1',
  user_name: 'Adam Wurf',
  status: 'pending',
  invite_id: null,
  invited_by_name: 'Simon',
  team_name: null,
  created_at: '2026-10-15T11:00:00Z',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  t.listInvitations.mockResolvedValue([])
  t.listInvites.mockResolvedValue([])
})

describe('InvitePerson', () => {
  it('searches on submit and shows for each person what can be done', async () => {
    t.listInvitations.mockResolvedValue([
      invitation(),
      invitation({ id: 'p2', user_id: 'u3', user_name: 'Cem Ball', status: 'declined' }),
    ])
    vi.mocked(api.users.search).mockResolvedValue([
      { id: 'u0', name: 'Ada Becher' },
      { id: 'u1', name: 'Adam Wurf' },
      { id: 'u2', name: 'Adrian Zorn' },
      { id: 'u3', name: 'Cem Ball' },
    ] as never)
    t.invitePerson.mockResolvedValue(invitation({ id: 'p9', user_id: 'u0', user_name: 'Ada Becher' }))
    render(<InvitePerson tournamentId="t1" participantIds={new Set(['u2'])} />)

    fireEvent.change(screen.getByLabelText('Person suchen'), { target: { value: 'ad' } })
    expect(api.users.search).not.toHaveBeenCalled() // not on every key
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }))

    const results = (await screen.findByText('Ada Becher')).closest<HTMLElement>('[role=list]')!
    expect(within(results).getByText('Dabei')).toBeInTheDocument() // Adrian plays already
    expect(within(results).getByText('Offen')).toBeInTheDocument() // Adam is invited
    expect(within(results).getByRole('button', { name: 'Cem Ball erneut einladen' })).toBeInTheDocument() // Cem declined
    fireEvent.click(within(results).getByRole('button', { name: 'Ada Becher einladen' }))

    await waitFor(() => expect(t.invitePerson).toHaveBeenCalledWith('t1', 'u0'))
    expect(toast.success).toHaveBeenCalledWith('Ada Becher eingeladen.')
  })

  it('searches again for the same text and says when nobody was found', async () => {
    vi.mocked(api.users.search).mockResolvedValue([])
    render(<InvitePerson tournamentId="t1" participantIds={new Set()} />)
    fireEvent.change(screen.getByLabelText('Person suchen'), { target: { value: 'zz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }))
    expect(await screen.findByText(/Niemand gefunden/)).toBeInTheDocument()

    fireEvent.submit(screen.getByLabelText('Person suchen').closest('form')!)
    await waitFor(() => expect(api.users.search).toHaveBeenCalledTimes(2))
  })

  it('lists who was invited directly, and removes an open invitation', async () => {
    t.listInvitations.mockResolvedValue([
      invitation(),
      invitation({ id: 'p2', user_id: 'u2', user_name: 'Ben Treffer', status: 'accepted', team_name: 'Becherhelden' }),
      invitation({ id: 'p3', user_id: 'u3', user_name: 'Vom Link', invite_id: 'l1', invited_by_name: null }),
    ])
    t.withdrawInvitation.mockResolvedValue(undefined)
    render(<InvitePerson tournamentId="t1" participantIds={new Set()} />)

    expect(await screen.findByText('Direkt eingeladen · 2')).toBeInTheDocument()
    expect(screen.getByText('Dabei · Becherhelden')).toBeInTheDocument()
    expect(screen.queryByText('Vom Link')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Einladung an Adam Wurf entfernen' }))
    await waitFor(() => expect(t.withdrawInvitation).toHaveBeenCalledWith('t1', 'p1'))
  })
})

describe('InvitationsPanel', () => {
  it('keeps the open invitations closed until asked for, with where they came from', async () => {
    t.listInvites.mockResolvedValue([{ id: 'l1', token: 'x', label: 'WhatsApp', created_at: '', deleted: false, opened: 1, joined: 0 }])
    t.listInvitations.mockResolvedValue([
      invitation(),
      invitation({ id: 'p2', user_id: 'u2', user_name: 'Gül Netz', invite_id: 'l1', invited_by_name: null }),
      invitation({ id: 'p3', user_id: 'u3', user_name: 'Dabei', status: 'accepted' }),
    ])
    render(<InvitationsPanel tournamentId="t1" participantIds={new Set()} />)

    const toggle = await screen.findByRole('button', { name: /Offene Einladungen \(2\)/ })
    expect(screen.queryByText('Gül Netz')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(await screen.findByText('· WhatsApp')).toBeInTheDocument()
    expect(screen.getByText('· direkt')).toBeInTheDocument()
  })

  it('opens the sheet to invite a person or by link', async () => {
    render(<InvitationsPanel tournamentId="t1" participantIds={new Set()} />)
    expect(screen.queryByText(/Offene Einladungen/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Einladen' }))
    expect(await screen.findByLabelText('Person suchen')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Link' })).toBeInTheDocument()
  })
})

describe('InvitationItem', () => {
  it('leads to the invitation and says who invites', () => {
    const item = {
      id: 'inv1',
      status: 'pending',
      created_at: '',
      tournament: { tournament_id: 't1', slug: 'cup', name: 'Sommer Cup', location: null, description: null, start_time: null, registration_open: true, join_policy: JoinPolicy.OPEN, phase: 'registration', team_count: 0, registration_end_time: null },
      invited_by_name: null,
      link_label: 'WhatsApp',
      team_id: null,
      team_name: null,
    } as Invitation
    render(<InvitationItem invitation={item} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/invitations/inv1')
    expect(screen.getByText('Über einen Einladungslink')).toBeInTheDocument()
  })
})
