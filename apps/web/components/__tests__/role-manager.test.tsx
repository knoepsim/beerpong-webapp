import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { render } from '@/lib/test-fixtures/render'
import { RoleManager } from '../role-manager'
import { api, ApiError } from '@/lib/api'
import { assignableRoles, mayRevoke } from '@/lib/roles'
import { TournamentRoleType, type TournamentUserRole } from '@/types'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { users: { search: vi.fn() }, roles: { assign: vi.fn(), revoke: vi.fn() } },
}))

const role = (id: string, userId: string, name: string | undefined, type: TournamentRoleType): TournamentUserRole =>
  ({ id, tournament_id: 't1', user_id: userId, user_name: name, role: type, assigned_at: '' }) as TournamentUserRole

const roles = [
  role('r2', 'u2', 'Ref Reese', TournamentRoleType.REFEREE),
  role('r1', 'u1', 'Alice Admin', TournamentRoleType.ADMIN),
  role('r3', 'u3', 'Max Manager', TournamentRoleType.MANAGER),
]

const openSheet = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Rolle vergeben' }))
  return screen.findByLabelText('Person suchen')
}

const search = async (text: string) => {
  fireEvent.change(await openSheet(), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Suchen' }))
}

beforeEach(() => vi.clearAllMocks())

describe('RoleManager', () => {
  it('lists the roles strongest first with their German names', () => {
    render(<RoleManager tournamentId="t1" roles={roles} userRole={TournamentRoleType.ADMIN} />)
    const names = within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.textContent)
    expect(names).toEqual(['Alice AdminAdmin', 'Max ManagerManager', 'Ref ReeseSchiedsrichter'])
  })

  it('lets an admin choose any role as a card, then add a person found', async () => {
    vi.mocked(api.users.search).mockResolvedValue([{ id: 'u9', name: 'Zed Zimmer' }, { id: 'u3', name: 'Max Manager' }] as never)
    vi.mocked(api.roles.assign).mockResolvedValue(roles[0])
    render(<RoleManager tournamentId="t1" roles={roles} userRole={TournamentRoleType.ADMIN} />)

    await search('ze')
    expect(screen.getByRole('radio', { name: /^Schiedsrichter/ })).toBeChecked() // the default
    fireEvent.click(screen.getByRole('radio', { name: /^Manager/ }))

    expect(await screen.findByText('Ist Manager')).toBeInTheDocument() // Max holds it already
    fireEvent.click(screen.getByRole('button', { name: 'Zed Zimmer als Manager hinzufügen' }))

    await waitFor(() => expect(api.roles.assign).toHaveBeenCalledWith('t1', 'u9', TournamentRoleType.MANAGER))
    expect(toast.success).toHaveBeenCalledWith('Zed Zimmer ist jetzt Manager.')
  })

  it('names the current role of a person who gets another one', async () => {
    vi.mocked(api.users.search).mockResolvedValue([{ id: 'u2', name: 'Ref Reese' }] as never)
    render(<RoleManager tournamentId="t1" roles={roles} userRole={TournamentRoleType.ADMIN} />)
    await search('re')
    fireEvent.click(screen.getByRole('radio', { name: /^Admin/ }))
    const row = (await screen.findByRole('button', { name: 'Ref Reese als Admin hinzufügen' })).closest('li')!
    expect(within(row).getByText('Schiedsrichter')).toBeInTheDocument()
  })

  it('gives a manager only the referee role, without a choice to make', async () => {
    render(<RoleManager tournamentId="t1" roles={roles} userRole={TournamentRoleType.MANAGER} />)
    expect(screen.getAllByRole('button', { name: /entziehen/ })).toHaveLength(1) // only the referee
    await openSheet()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByText(/Du vergibst die Rolle/)).toHaveTextContent('Schiedsrichter')
  })

  it('offers nothing to give to a referee', () => {
    render(<RoleManager tournamentId="t1" roles={roles} userRole={TournamentRoleType.REFEREE} />)
    expect(screen.queryByRole('button', { name: 'Rolle vergeben' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /entziehen/ })).not.toBeInTheDocument()
  })

  it('reports a refused assignment', async () => {
    vi.mocked(api.users.search).mockResolvedValue([{ id: 'u9', name: 'Zed Zimmer' }] as never)
    vi.mocked(api.roles.assign).mockRejectedValue(new ApiError(409, { detail: 'Hat die Rolle schon.' }))
    render(<RoleManager tournamentId="t1" roles={roles} userRole={TournamentRoleType.ADMIN} />)
    await search('ze')
    fireEvent.click(await screen.findByRole('button', { name: 'Zed Zimmer als Schiedsrichter hinzufügen' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Hat die Rolle schon.'))
  })

  it('takes a role away after a confirmation that names the consequence', async () => {
    vi.mocked(api.roles.revoke).mockResolvedValue(undefined)
    render(<RoleManager tournamentId="t1" roles={roles} userRole={TournamentRoleType.ADMIN} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ref Reese: Rolle Schiedsrichter entziehen' }))
    expect(await screen.findByText('Ref Reese kann das Turnier danach nicht mehr als Schiedsrichter leiten.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Rolle entziehen' }))

    await waitFor(() => expect(api.roles.revoke).toHaveBeenCalledWith('t1', 'r2'))
    expect(toast.success).toHaveBeenCalledWith('Rolle entzogen.')
  })
})

describe('roles', () => {
  it('follow the rules of the API: admins give and take all, managers referees, referees nothing', () => {
    expect(assignableRoles(TournamentRoleType.ADMIN)).toHaveLength(3)
    expect(assignableRoles(TournamentRoleType.MANAGER)).toEqual([TournamentRoleType.REFEREE])
    expect(assignableRoles(null)).toEqual([])
    expect(mayRevoke(TournamentRoleType.MANAGER, TournamentRoleType.MANAGER)).toBe(false)
  })
})
