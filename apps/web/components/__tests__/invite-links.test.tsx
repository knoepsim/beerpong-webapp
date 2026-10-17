import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@/lib/test-fixtures/render'
import { InviteLinks } from '../invite-links'
import { api } from '@/lib/api'
import type { TournamentInvite } from '@/types'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { tournaments: { listInvites: vi.fn(), createInvite: vi.fn(), deleteInvite: vi.fn() } },
}))

const mocked = {
  list: vi.mocked(api.tournaments.listInvites),
  create: vi.mocked(api.tournaments.createInvite),
  remove: vi.mocked(api.tournaments.deleteInvite),
}

const invite = (overrides: Partial<TournamentInvite> = {}): TournamentInvite => ({
  id: 'i1',
  token: 'abc2345',
  label: 'WhatsApp',
  created_at: '2026-10-15T10:00:00Z',
  uses: 3,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
})
afterEach(() => cleanup())

describe('InviteLinks', () => {
  it('lists the links with name, address and what they brought', async () => {
    mocked.list.mockResolvedValue([invite(), invite({ id: 'i2', token: 'xyz9876', label: null, uses: 1 })])
    render(<InviteLinks tournamentId="t1" />)

    expect(await screen.findByText('WhatsApp')).toBeInTheDocument()
    expect(screen.getByText('/invite/abc2345')).toBeInTheDocument()
    expect(screen.getByText('3 Teams beigetreten')).toBeInTheDocument()
    expect(screen.getByText('Einladungslink')).toBeInTheDocument() // unnamed
    expect(screen.getByText('1 Team beigetreten')).toBeInTheDocument()
  })

  it('says that nobody can join without a link', async () => {
    mocked.list.mockResolvedValue([])
    render(<InviteLinks tournamentId="t1" />)
    expect(await screen.findByText(/Ohne Link kann niemand mehr beitreten/)).toBeInTheDocument()
  })

  it('creates a link with a name and reloads', async () => {
    mocked.list.mockResolvedValue([])
    mocked.create.mockResolvedValue(invite())
    render(<InviteLinks tournamentId="t1" />)
    await screen.findByText(/Ohne Link/)

    fireEvent.change(screen.getByLabelText('Neuer Link'), { target: { value: '  Plakat ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Link erstellen' }))

    await waitFor(() => expect(mocked.create).toHaveBeenCalledWith('t1', 'Plakat'))
    await waitFor(() => expect(mocked.list).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText('Neuer Link')).toHaveValue('')
  })

  it('copies the address of a link', async () => {
    mocked.list.mockResolvedValue([invite()])
    render(<InviteLinks tournamentId="t1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Link WhatsApp kopieren' }))

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/abc2345`))
    expect(toast.success).toHaveBeenCalledWith('Link kopiert.')
  })

  it('deletes only after the consequences were named', async () => {
    mocked.list.mockResolvedValue([invite()])
    mocked.remove.mockResolvedValue(undefined)
    render(<InviteLinks tournamentId="t1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Link WhatsApp löschen' }))
    expect(screen.getByText(/Teams, die schon beigetreten sind, bleiben im/)).toBeInTheDocument()
    expect(mocked.remove).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Link löschen' }))
    await waitFor(() => expect(mocked.remove).toHaveBeenCalledWith('t1', 'i1'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Link gelöscht.'))
  })

  it('reports failures', async () => {
    mocked.list.mockRejectedValue(new Error('x'))
    render(<InviteLinks tournamentId="t1" />)
    expect(await screen.findByText('Die Einladungslinks konnten nicht geladen werden.')).toBeInTheDocument()

    mocked.list.mockResolvedValue([invite()])
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByText('WhatsApp')).toBeInTheDocument()
  })
})
