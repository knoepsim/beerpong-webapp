import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TournamentPreviewCard } from '../tournament-preview'
import { JoinPolicy, type TournamentPreview } from '@/types'

const preview = (overrides: Partial<TournamentPreview> = {}): TournamentPreview => ({
  tournament_id: 't1',
  slug: 'sommerfest',
  name: 'Sommerfest',
  location: 'Garten',
  start_time: '2099-07-01T18:00:00Z',
  registration_open: true,
  join_policy: JoinPolicy.OPEN,
  ...overrides,
})

describe('TournamentPreviewCard', () => {
  it('shows what a stranger needs to decide: name, time, place', () => {
    render(<TournamentPreviewCard preview={preview()}>Aktion</TournamentPreviewCard>)
    expect(screen.getByRole('heading', { name: 'Sommerfest' })).toBeInTheDocument()
    expect(screen.getByText(/Uhr$/)).toBeInTheDocument()
    expect(screen.getByText('Garten')).toBeInTheDocument()
    expect(screen.getByText('Aktion')).toBeInTheDocument()
  })

  it('omits what is not set and says when the registration is closed', () => {
    render(<TournamentPreviewCard preview={preview({ location: null, start_time: null, registration_open: false })} />)
    expect(screen.queryByText('Garten')).not.toBeInTheDocument()
    expect(screen.getByText('Die Anmeldung ist geschlossen.')).toBeInTheDocument()
  })
})
