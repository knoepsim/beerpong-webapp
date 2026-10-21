import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '@/lib/test-fixtures/render'
import { Landing } from '../landing'
import { api } from '@/lib/api'
import type { User } from '@/types'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { users: { me: vi.fn() } },
}))

describe('Landing', () => {
  beforeEach(() => vi.clearAllMocks())

  it('leads a visitor to the login', async () => {
    vi.mocked(api.users.me).mockRejectedValue(new Error('no session'))
    render(<Landing hasSession />)
    expect(await screen.findByRole('heading', { name: 'Turniere einfach organisieren.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Jetzt starten/ })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/login')
  })

  it('greets a logged-in user by name and leads into the app', async () => {
    vi.mocked(api.users.me).mockResolvedValue({ id: 'u', name: 'Simon' } as User)
    render(<Landing hasSession />)
    expect(await screen.findByRole('heading', { name: 'Hallo Simon!' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Zu meinen Turnieren/ })).toHaveAttribute('href', '/tournaments')
    expect(screen.getByRole('link', { name: /Turnier erstellen/ })).toHaveAttribute('href', '/tournaments/new')
    expect(screen.queryByRole('link', { name: 'Anmelden' })).not.toBeInTheDocument()
  })

  it('shows a visitor without a session the page at once, without asking the server', () => {
    render(<Landing hasSession={false} />)
    expect(screen.getByRole('heading', { name: 'Turniere einfach organisieren.' })).toBeInTheDocument()
  })
})
