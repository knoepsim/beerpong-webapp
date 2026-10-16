import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { TablesBoard } from '../tables-board'
import { api } from '@/lib/api'
import { fiveTeamBracket, fiveTeams } from '@/lib/test-fixtures/bracket'
import type { TournamentTable } from '@/types'

vi.mock('@/lib/api', () => ({ api: { matches: { start: vi.fn() } } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const tables: TournamentTable[] = [
  { id: 'x1', name: 'Tisch 1', position: 1 },
  { id: 'x2', name: 'Tisch 2', position: 2 },
  { id: 'x3', name: 'Tisch 3', position: 3 },
]
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString()
const card = (name: string) => screen.getByRole('heading', { name }).closest('li')!

describe('TablesBoard', () => {
  beforeEach(() => vi.mocked(api.matches.start).mockReset().mockResolvedValue(undefined))

  it('shows every table with its match and since when, free tables as free', () => {
    const bracket = fiveTeamBracket({
      m1: { status: 'live', started_at: minutesAgo(8), on_table_at: minutesAgo(10) },
      m3: { on_table_at: minutesAgo(2) },
    })
    render(<TablesBoard bracket={bracket} tables={tables} teamsMap={fiveTeams} onChanged={vi.fn()} />)

    expect(within(card('Tisch 1')).getByText('seit 8 Min.')).toBeInTheDocument()
    expect(within(card('Tisch 1')).getByText('Live')).toBeInTheDocument()
    expect(within(card('Tisch 2')).getByText('Bereit')).toBeInTheDocument()
    expect(within(card('Tisch 3')).getByText('Frei')).toBeInTheDocument()
    expect(screen.getByText('1 live · 1 bereit · 1 frei')).toBeInTheDocument()
    // players see no buttons
    expect(screen.queryByRole('button', { name: /Ergebnis|starten/ })).not.toBeInTheDocument()
  })

  it('warns when a match waits at its table without a start, teams may be missing', () => {
    const bracket = fiveTeamBracket({ m3: { on_table_at: minutesAgo(7) } })
    render(<TablesBoard bracket={bracket} tables={tables} teamsMap={fiveTeams} onChanged={vi.fn()} />)
    expect(within(card('Tisch 2')).getByText('seit 7 Min. nicht gestartet')).toBeInTheDocument()
  })

  it('lets the organization start a match and enter results at the table', async () => {
    const onResult = vi.fn()
    const onChanged = vi.fn()
    const bracket = fiveTeamBracket({ m1: { status: 'live', started_at: minutesAgo(3) } })
    render(<TablesBoard bracket={bracket} tables={tables} teamsMap={fiveTeams} onResult={onResult} onChanged={onChanged} />)

    expect(within(card('Tisch 1')).queryByRole('button', { name: 'Spiel starten' })).not.toBeInTheDocument()
    fireEvent.click(within(card('Tisch 1')).getByRole('button', { name: 'Ergebnis eintragen' }))
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }))

    fireEvent.click(within(card('Tisch 2')).getByRole('button', { name: 'Spiel starten' }))
    await waitFor(() => expect(api.matches.start).toHaveBeenCalledWith('m3'))
    expect(onChanged).toHaveBeenCalled()
  })

  it('keeps the queue closed until asked for', () => {
    const queued = (place: number) => ({ status: 'queued' as const, table_id: null, table_name: null, queue_position: place })
    render(
      <TablesBoard bracket={fiveTeamBracket({ m1: queued(1) })} tables={tables} teamsMap={fiveTeams} onChanged={vi.fn()} />,
    )
    const toggle = screen.getByRole('button', { name: 'Warteschlange (1)' })
    expect(screen.queryByText('Platz 1')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(screen.getByText('Platz 1')).toBeInTheDocument()
  })
})
