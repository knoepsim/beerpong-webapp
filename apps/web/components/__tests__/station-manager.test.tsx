import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@/lib/test-fixtures/render'
import { TableManager } from '../table-manager'
import { api, ApiError } from '@/lib/api'
import type { TournamentTable } from '@/types'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { tournaments: { listTables: vi.fn(), addTable: vi.fn(), renameTable: vi.fn(), deleteTable: vi.fn() } },
}))

const mocked = {
  list: vi.mocked(api.tournaments.listTables),
  add: vi.mocked(api.tournaments.addTable),
  rename: vi.mocked(api.tournaments.renameTable),
  remove: vi.mocked(api.tournaments.deleteTable),
}
const table = (n: number, name = `Tisch ${n}`): TournamentTable => ({ id: `t${n}`, name, position: n })

beforeEach(() => vi.clearAllMocks())
afterEach(() => cleanup())

const setup = async (tables: TournamentTable[]) => {
  mocked.list.mockResolvedValue(tables)
  render(<TableManager tournamentId="x" />)
  await screen.findByRole('button', { name: 'Tisch hinzufügen' })
}

describe('TableManager', () => {
  it('shows every table as a card with its name', async () => {
    await setup([table(1), table(2, 'Terrasse')])
    expect(screen.getByText('Tisch 1')).toBeInTheDocument()
    expect(screen.getByText('Terrasse')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3) // two tables and the card to add one
  })

  it('adds a table that gets its name from the server', async () => {
    await setup([table(1)])
    mocked.add.mockResolvedValue(table(2))
    mocked.list.mockResolvedValue([table(1), table(2)]) // what the list says when it is loaded again

    fireEvent.click(screen.getByRole('button', { name: 'Tisch hinzufügen' }))

    expect(await screen.findByText('Tisch 2')).toBeInTheDocument()
    expect(mocked.add).toHaveBeenCalledWith('x')
  })

  it('renames a table: the pencil opens the field, Enter saves', async () => {
    await setup([table(1), table(2)])
    mocked.rename.mockResolvedValue(table(1, 'Pool'))
    mocked.list.mockResolvedValue([table(1, 'Pool'), table(2)])

    fireEvent.click(screen.getByRole('button', { name: 'Tisch 1 umbenennen' }))
    const input = screen.getByRole('textbox', { name: 'Name von Tisch 1' })
    expect(input).toHaveValue('Tisch 1')
    fireEvent.change(input, { target: { value: 'Pool' } })
    fireEvent.submit(input.closest('form')!)

    expect(await screen.findByText('Pool')).toBeInTheDocument()
    expect(mocked.rename).toHaveBeenCalledWith('x', 't1', 'Pool')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('closes the field without a request when the name did not change or the edit is cancelled', async () => {
    await setup([table(1), table(2)])

    fireEvent.click(screen.getByRole('button', { name: 'Tisch 1 umbenennen' }))
    fireEvent.submit(screen.getByRole('textbox').closest('form')!)
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Tisch 2 umbenennen' }))
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(mocked.rename).not.toHaveBeenCalled()
  })

  it('says at the field why a name is refused and keeps it open', async () => {
    await setup([table(1), table(2)])
    mocked.rename.mockRejectedValue(new ApiError(409, { detail: 'Einen Tisch mit diesem Namen gibt es schon.' }))

    fireEvent.click(screen.getByRole('button', { name: 'Tisch 1 umbenennen' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tisch 2' } })
    fireEvent.submit(screen.getByRole('textbox').closest('form')!)

    expect(await screen.findByText('Einen Tisch mit diesem Namen gibt es schon.')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('deletes a table only after it was confirmed', async () => {
    await setup([table(1), table(2)])
    mocked.remove.mockResolvedValue(undefined)
    mocked.list.mockResolvedValue([table(1)])

    fireEvent.click(screen.getByRole('button', { name: 'Tisch 2 löschen' }))
    expect(screen.getByText('Tisch 2 löschen?')).toBeInTheDocument()
    expect(mocked.remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Tisch löschen' }))

    await waitFor(() => expect(mocked.remove).toHaveBeenCalledWith('x', 't2'))
    await waitFor(() => expect(screen.queryByText('Tisch 2')).not.toBeInTheDocument())
  })

  it('does not offer to delete the only table and says why', async () => {
    await setup([table(1)])
    expect(screen.getByRole('button', { name: 'Tisch 1 löschen' })).toBeDisabled()
    expect(screen.getByText('Ein Turnier braucht mindestens einen Tisch.')).toBeInTheDocument()
  })

  it('reports what the server refuses', async () => {
    await setup([table(1)])
    mocked.add.mockRejectedValue(new ApiError(400, { detail: 'Ein Turnier kann höchstens 100 Tische haben.' }))

    fireEvent.click(screen.getByRole('button', { name: 'Tisch hinzufügen' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Ein Turnier kann höchstens 100 Tische haben.'))
  })
})
