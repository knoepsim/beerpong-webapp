import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@/lib/test-fixtures/render'
import { NewTournamentForm } from '../new-tournament-form'
import { api } from '@/lib/api'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { tournaments: { create: vi.fn() } },
}))
// the editor is ProseMirror; here a text field stands in for it
vi.mock('@/components/markdown-editor', () => ({
  MarkdownEditor: ({ value, onChange, 'aria-label': label }: { value: string; onChange: (v: string) => void; 'aria-label'?: string }) => (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const DRAFT = 'draft:new-tournament'
const draft = (values: Record<string, unknown>) => sessionStorage.setItem(DRAFT, JSON.stringify(values))
const next = () => fireEvent.click(screen.getByRole('button', { name: /Weiter/ }))
const step = (title: string) => screen.findByText((_, el) => el?.tagName === 'P' && !!el.textContent?.endsWith(`· ${title}`))

describe('NewTournamentForm', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('needs a game and a mode before it goes on, and the coming modes cannot be chosen', async () => {
    render(<NewTournamentForm />)
    next()
    expect(await screen.findByText('Wähle aus, was gespielt wird.')).toBeInTheDocument()
    expect(screen.getByText('Wähle aus, wie gespielt wird.')).toBeInTheDocument()
    expect(screen.getByText('Schritt 1 von 4 ·', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Jeder gegen jeden/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('checks each step for its own fields: a missing start stays on the schedule', async () => {
    draft({ game: 'beerpong', mode: 'single_elimination', name: 'Sommer Cup' })
    render(<NewTournamentForm />)
    expect(screen.getByText('Dein Entwurf von vorhin ist wieder da.')).toBeInTheDocument()
    next()
    await step('Turnier')
    next()
    await step('Zeitplan')
    next()
    expect(await screen.findByText('Bitte gib ein Startdatum und eine Startzeit an.')).toBeInTheDocument()
    expect(screen.getByLabelText('Startzeit *')).toHaveAttribute('aria-invalid', 'true')
  })

  it('creates the tournament with game and mode and goes to it', async () => {
    vi.mocked(api.tournaments.create).mockResolvedValue({ slug: 'sommer-cup' } as never)
    draft({
      game: 'beerpong',
      mode: 'single_elimination',
      name: 'Sommer Cup',
      schedule: { start_time: '2099-07-01T18:00' },
    })
    render(<NewTournamentForm />)
    next()
    await step('Turnier')
    next()
    await step('Zeitplan')
    next()
    await step('Zugang & Tische')
    fireEvent.click(screen.getByRole('button', { name: 'Turnier erstellen' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/t/sommer-cup'))
    expect(api.tournaments.create).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'beerpong', mode: 'single_elimination', name: 'Sommer Cup', table_count: 1 }),
    )
    expect(sessionStorage.getItem(DRAFT)).toBeNull()
  })

  it('starts over without the draft', async () => {
    draft({ name: 'Alt' })
    render(<NewTournamentForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Neu beginnen' }))
    expect(screen.queryByText('Dein Entwurf von vorhin ist wieder da.')).not.toBeInTheDocument()
    expect(sessionStorage.getItem(DRAFT)).toBeNull()
  })
})
