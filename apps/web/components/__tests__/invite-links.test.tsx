import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { render } from '@/lib/test-fixtures/render'
import { InviteLinks } from '../invite-links'
import { api } from '@/lib/api'
import type { TournamentInvitation, TournamentInvite } from '@/types'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: {
    tournaments: {
      listInvites: vi.fn(),
      createInvite: vi.fn(),
      deleteInvite: vi.fn(),
      listInvitations: vi.fn(),
      withdrawInvitation: vi.fn(),
    },
  },
}))

const t = vi.mocked(api.tournaments)

const invite = (overrides: Partial<TournamentInvite> = {}): TournamentInvite => ({
  id: 'i1',
  token: 'abc2345',
  label: 'WhatsApp',
  created_at: '2026-10-15T10:00:00Z',
  deleted: false,
  opened: 3,
  joined: 1,
  ...overrides,
})

const invitation = (overrides: Partial<TournamentInvitation> = {}): TournamentInvitation => ({
  id: 'p1',
  user_id: 'u1',
  user_name: 'Gül Netz',
  status: 'pending',
  invite_id: 'i1',
  invited_by_name: null,
  team_name: null,
  created_at: '2026-10-15T11:00:00Z',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  t.listInvitations.mockResolvedValue([])
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
})
afterEach(() => cleanup())

describe('InviteLinks', () => {
  it('lists the links with how many opened them and play, deleted ones last and without actions', async () => {
    t.listInvites.mockResolvedValue([
      invite({ id: 'old', label: 'Plakat', deleted: true, opened: 2, joined: 0 }),
      invite(),
      invite({ id: 'i2', token: 'xyz9876', label: null, opened: 0, joined: 0 }),
    ])
    render(<InviteLinks tournamentId="t1" />)

    expect(await screen.findByText('3 geöffnet · 1 dabei')).toBeInTheDocument()
    expect(screen.getByText('Noch nicht geöffnet')).toBeInTheDocument()
    expect(screen.getByText('Einladungslink')).toBeInTheDocument() // unnamed
    expect(screen.getByText('Gelöscht · 2 geöffnet · 0 dabei')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Link Plakat kopieren' })).not.toBeInTheDocument()
    const names = screen.getAllByText(/^(WhatsApp|Einladungslink|Plakat)$/).map((el) => el.textContent)
    expect(names.at(-1)).toBe('Plakat')
  })

  it('shows who opened a link and removes an open invitation from the account', async () => {
    t.listInvites.mockResolvedValue([invite()])
    t.listInvitations.mockResolvedValue([
      invitation(),
      invitation({ id: 'p2', user_id: 'u2', user_name: 'Dana Kugel', status: 'accepted', team_name: 'Zielwasser' }),
      invitation({ id: 'p3', user_id: 'u3', user_name: 'Direkt', invite_id: null }),
    ])
    t.withdrawInvitation.mockResolvedValue(undefined)
    render(<InviteLinks tournamentId="t1" />)

    fireEvent.click(await screen.findByText('WhatsApp'))
    expect(await screen.findByText('Dabei · Zielwasser')).toBeInTheDocument()
    expect(screen.queryByText('Direkt')).not.toBeInTheDocument() // not from this link
    fireEvent.click(screen.getByRole('button', { name: 'Einladung an Gül Netz entfernen' }))

    await waitFor(() => expect(t.withdrawInvitation).toHaveBeenCalledWith('t1', 'p1'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Einladung an Gül Netz entfernt.'))
  })

  it('says that a link was not opened yet', async () => {
    t.listInvites.mockResolvedValue([invite({ opened: 0, joined: 0 })])
    render(<InviteLinks tournamentId="t1" />)
    fireEvent.click(await screen.findByText('WhatsApp'))
    expect(await screen.findByText('Noch niemand hat den Link mit einem Konto geöffnet.')).toBeInTheDocument()
  })

  it('explains links when there is none', async () => {
    t.listInvites.mockResolvedValue([])
    render(<InviteLinks tournamentId="t1" />)
    expect(await screen.findByText(/Jeder Link zeigt dir, wer ihn geöffnet hat/)).toBeInTheDocument()
  })

  it('creates a link with a name and loads the list again', async () => {
    t.listInvites.mockResolvedValue([])
    t.createInvite.mockResolvedValue(invite())
    render(<InviteLinks tournamentId="t1" />)
    await screen.findByText(/Noch kein Link/)

    fireEvent.change(screen.getByLabelText('Neuer Link'), { target: { value: '  Plakat ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Link erstellen' }))

    await waitFor(() => expect(t.createInvite).toHaveBeenCalledWith('t1', 'Plakat'))
    await waitFor(() => expect(t.listInvites).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText('Neuer Link')).toHaveValue('')
  })

  it('copies and shares the address of a link', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError'))
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    t.listInvites.mockResolvedValue([invite()])
    render(<InviteLinks tournamentId="t1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Link WhatsApp kopieren' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/abc2345`))
    expect(toast.success).toHaveBeenCalledWith('Link kopiert.')

    fireEvent.click(screen.getByRole('button', { name: 'Link WhatsApp teilen' }))
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: 'Einladung zum Turnier', url: `${window.location.origin}/invite/abc2345` }))
    expect(toast.error).not.toHaveBeenCalled()
    Reflect.deleteProperty(navigator, 'share')
  })

  it('deletes a link only after a confirmation that names what stays', async () => {
    t.listInvites.mockResolvedValue([invite()])
    t.listInvitations.mockResolvedValue([invitation(), invitation({ id: 'p2', user_id: 'u2' })])
    t.deleteInvite.mockResolvedValue(undefined)
    render(<InviteLinks tournamentId="t1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Link WhatsApp löschen' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/2 offene Einladungen bleiben im Konto/)).toBeInTheDocument()
    expect(t.deleteInvite).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Link löschen' }))
    await waitFor(() => expect(t.deleteInvite).toHaveBeenCalledWith('t1', 'i1'))
    expect(toast.success).toHaveBeenCalledWith('Link gelöscht.')
  })

  it('offers loading again when the links cannot be loaded', async () => {
    t.listInvites.mockRejectedValue(new Error('x'))
    render(<InviteLinks tournamentId="t1" />)
    expect(await screen.findByText('Die Einladungslinks konnten nicht geladen werden.')).toBeInTheDocument()

    t.listInvites.mockResolvedValue([invite()])
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByText('WhatsApp')).toBeInTheDocument()
  })
})
