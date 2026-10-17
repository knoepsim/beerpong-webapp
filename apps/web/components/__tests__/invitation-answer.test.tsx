import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@/lib/test-fixtures/render'
import { InvitationAnswer, invitationFrom } from '../invitation-answer'
import { TournamentPreviewCard } from '../tournament-preview'
import { api, ApiError } from '@/lib/api'
import { JoinPolicy, type Invitation, type Team } from '@/types'

const push = vi.fn()
const replace = vi.fn()
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }))
vi.mock('sonner', () => ({ toast }))
vi.mock('react-markdown', () => ({ default: ({ children }: { children: string }) => <p>{children}</p> }))
vi.mock('remark-gfm', () => ({ default: () => {} }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: {
    teams: { list: vi.fn(), create: vi.fn(), createInvite: vi.fn() },
    invitations: { accept: vi.fn(), decline: vi.fn(), reopen: vi.fn() },
  },
}))

const preview = {
  tournament_id: 't1',
  slug: 'cup',
  name: 'Sommer Cup',
  location: 'Garten',
  description: null,
  start_time: '2099-07-01T18:00:00Z',
  registration_open: true,
  join_policy: JoinPolicy.INVITE_ONLY,
  phase: 'registration' as const,
  team_count: 12,
  registration_end_time: null,
}

const invitation = (overrides: Partial<Invitation> = {}): Invitation => ({
  id: 'inv1',
  status: 'pending',
  created_at: '2026-10-15T10:00:00Z',
  tournament: preview,
  invited_by_name: 'Simon',
  link_label: null,
  team_id: null,
  team_name: null,
  ...overrides,
})

const team = (id: string, name: string, complete = true): Team =>
  ({
    id,
    name,
    max_size: 2,
    is_complete: complete,
    members: complete ? [{ user_id: 'a', name: 'Ada' }, { user_id: 'b', name: 'Ben' }] : [{ user_id: 'a', name: 'Ada' }],
    delete_blockers: [],
  }) as unknown as Team

beforeEach(() => vi.clearAllMocks())

describe('InvitationAnswer', () => {
  it('accepts with the complete team and goes to the tournament', async () => {
    vi.mocked(api.teams.list).mockResolvedValue([team('solo', 'Solo', false), team('a', 'Becherhelden')])
    vi.mocked(api.invitations.accept).mockResolvedValue(invitation({ status: 'accepted', team_name: 'Becherhelden' }))
    render(<InvitationAnswer invitation={invitation()} />)

    // the complete team is chosen already
    fireEvent.click(await screen.findByRole('button', { name: 'Mit Becherhelden beitreten' }))

    await waitFor(() => expect(api.invitations.accept).toHaveBeenCalledWith('inv1', 'a'))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/t/cup'))
    expect(toast.success).toHaveBeenCalledWith('Du bist mit Becherhelden bei Sommer Cup dabei.')
  })

  it('asks for the team mate when the chosen team is not complete, and offers a new team', async () => {
    vi.mocked(api.teams.list).mockResolvedValue([team('solo', 'Solo', false)])
    vi.mocked(api.teams.createInvite).mockResolvedValue({ token: 'tok' } as never)
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
    render(<InvitationAnswer invitation={invitation()} />)

    expect(await screen.findByText(/Solo braucht noch einen Mitspieler/)).toBeInTheDocument()
    expect(screen.getByText('1 von 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /beitreten/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mitspieler einladen' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/teams/join/tok`))

    fireEvent.click(screen.getByRole('button', { name: 'Neues Team gründen' }))
    expect(screen.getByLabelText('Name deines Teams')).toBeInTheDocument()
  })

  it('founds a team right here when there is none', async () => {
    vi.mocked(api.teams.list).mockResolvedValue([])
    vi.mocked(api.teams.create).mockResolvedValue(team('n', 'Neu', false))
    render(<InvitationAnswer invitation={invitation()} />)

    fireEvent.change(await screen.findByLabelText('Name deines Teams'), { target: { value: ' Neu ' } })
    vi.mocked(api.teams.list).mockResolvedValue([team('n', 'Neu', false)])
    fireEvent.click(screen.getByRole('button', { name: 'Team gründen' }))

    await waitFor(() => expect(api.teams.create).toHaveBeenCalledWith('Neu'))
    expect(await screen.findByText(/Neu braucht noch einen Mitspieler/)).toBeInTheDocument()
  })

  it('says at the button why accepting failed', async () => {
    vi.mocked(api.teams.list).mockResolvedValue([team('a', 'Becherhelden')])
    vi.mocked(api.invitations.accept).mockRejectedValue(new ApiError(409, { detail: 'Ein Spieler spielt schon mit.' }))
    render(<InvitationAnswer invitation={invitation()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Mit Becherhelden beitreten' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ein Spieler spielt schon mit.')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('declines, goes back to the tournaments and offers to undo it', async () => {
    vi.mocked(api.teams.list).mockResolvedValue([])
    vi.mocked(api.invitations.decline).mockResolvedValue(invitation({ status: 'declined' }))
    vi.mocked(api.invitations.reopen).mockResolvedValue(invitation())
    render(<InvitationAnswer invitation={invitation()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Einladung ablehnen' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/tournaments'))
    const [message, options] = toast.success.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }]
    expect(message).toBe('Einladung zu Sommer Cup abgelehnt.')
    expect(options.action.label).toBe('Rückgängig')
    options.action.onClick()
    await waitFor(() => expect(api.invitations.reopen).toHaveBeenCalledWith('inv1'))
  })

  it('shows an answer that was given', () => {
    const { rerender } = render(<InvitationAnswer invitation={invitation({ status: 'accepted', team_name: 'Becherhelden' })} />)
    expect(screen.getByText('Du bist mit Becherhelden dabei.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zum Turnier' })).toHaveAttribute('href', '/t/cup')

    rerender(<InvitationAnswer invitation={invitation({ status: 'withdrawn' })} />)
    expect(screen.getByText('Diese Einladung wurde zurückgezogen.')).toBeInTheDocument()

    rerender(<InvitationAnswer invitation={invitation({ status: 'declined' })} />)
    expect(screen.getByText('Du hast diese Einladung abgelehnt.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Doch antworten' })).toBeInTheDocument()
  })

  it('offers nothing once the registration is closed', () => {
    render(<InvitationAnswer invitation={invitation({ tournament: { ...preview, registration_open: false } })} />)
    expect(screen.getByText('Die Anmeldung ist geschlossen.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('TournamentPreviewCard as an invitation', () => {
  it('names the tournament, who invites, the teams and a closing deadline', () => {
    render(
      <TournamentPreviewCard
        preview={{ ...preview, registration_end_time: '2099-06-30T18:00:00Z' }}
        invitation={{ from: invitationFrom({ invited_by_name: 'Simon' }) }}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Sommer Cup' })).toBeInTheDocument()
    expect(screen.getByText('Simon lädt dich ein')).toBeInTheDocument()
    expect(screen.getByText(/12 Teams angemeldet · Anmeldung bis/)).toBeInTheDocument()
    expect(invitationFrom({ invited_by_name: null })).toBe('Du bist eingeladen')
  })

  it('shows a long description in short with "Mehr"', () => {
    const description = 'Regeln '.repeat(40)
    render(<TournamentPreviewCard preview={{ ...preview, description, team_count: 1 }} invitation={{ from: 'x' }} />)
    expect(screen.getByText('1 Team angemeldet')).toBeInTheDocument()
    const more = screen.getByRole('button', { name: 'Mehr' })
    fireEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(more).toHaveTextContent('Weniger')
  })
})
