import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@/lib/test-fixtures/render'
import { KnockoutStart } from '../knockout-start'
import { api } from '@/lib/api'
import { groupsBracket } from '@/lib/test-fixtures/bracket'
import { makeTournament } from '@/lib/test-fixtures/tournament'
import { TournamentMode, type Team } from '@/types'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { tournaments: { startKnockout: vi.fn() } },
}))

const teams = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((id) => [id, { id, name: `Team ${id}` } as Team]))
const tournament = makeTournament({ mode: TournamentMode.GROUPS_KNOCKOUT, group_count: 2, advance_per_group: 1, started_at: '2099-07-01T18:00:00Z' })
const allPlayed = () =>
  groupsBracket({ matches: groupsBracket().matches.map((m) => (m.group ? { ...m, status: 'finished' as const } : m)) })

describe('KnockoutStart', () => {
  beforeEach(() => vi.clearAllMocks())

  it('waits for the open group matches', () => {
    render(<KnockoutStart tournament={tournament} bracket={groupsBracket()} teamsMap={teams} />)
    expect(screen.getByText(/Noch 2 Spiele offen/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'K.-o.-Runde starten' })).not.toBeInTheDocument()
  })

  it('lets the organization order a tie and starts with that order', async () => {
    vi.mocked(api.tournaments.startKnockout).mockResolvedValue(undefined)
    render(<KnockoutStart tournament={tournament} bracket={allPlayed()} teamsMap={teams} />)
    // group B: d and e share the first place, only one goes on
    expect(screen.getByText('Gleichstand in Gruppe B: Lege die Reihenfolge fest.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Team e nach oben' }))
    fireEvent.click(screen.getByRole('button', { name: 'K.-o.-Runde starten' }))
    expect(await screen.findByText(/Weiter kommen: Gruppe A: Team a; Gruppe B: Team e/)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'K.-o.-Runde starten' }).at(-1)!)
    await waitFor(() => expect(api.tournaments.startKnockout).toHaveBeenCalledWith('t', { 2: ['e', 'd'] }))
  })
})
