import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { render } from '@/lib/test-fixtures/render';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { TournamentSettings } from '../tournament-settings';
import { api, ApiError } from '@/lib/api';
import { JoinPolicy, TournamentMode, TournamentRoleType, TournamentVisibility } from '@/types';
import type { Tournament, TournamentUserRole, User } from '@/types';

const push = vi.fn();
const replace = vi.fn();
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('sonner', () => ({ toast }));
vi.mock('react-markdown', () => ({ default: ({ children }: { children: ReactNode }) => <div data-testid="markdown">{children}</div> }));
vi.mock('remark-gfm', () => ({ default: () => {} }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: {
    tournaments: { update: vi.fn(), delete: vi.fn(), listInvites: vi.fn(), createInvite: vi.fn(), deleteInvite: vi.fn(), listTables: vi.fn() },
    users: { search: vi.fn() },
    roles: { assign: vi.fn(), revoke: vi.fn() },
  },
}));

// Popover based primitives are replaced by flat equivalents; the component logic stays real.
vi.mock('@/components/ui/select', () => {
  const Ctx = createContext<(v: string) => void>(() => {});
  return {
    Select: ({ onValueChange, children }: { onValueChange: (v: string) => void; children: ReactNode }) => (
      <Ctx.Provider value={onValueChange}><div>{children}</div></Ctx.Provider>
    ),
    SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: ReactNode }) => {
      const onValueChange = useContext(Ctx);
      return <button type="button" onClick={() => onValueChange(value)}>{children}</button>;
    },
  };
});
vi.mock('@/components/ui/tabs', () => {
  const Ctx = createContext<{ value: string; set: (v: string) => void }>({ value: '', set: () => {} });
  return {
    Tabs: ({ defaultValue, children }: { defaultValue: string; children: ReactNode }) => {
      const [value, set] = useState(defaultValue);
      return <Ctx.Provider value={{ value, set }}><div>{children}</div></Ctx.Provider>;
    },
    TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({ value, children }: { value: string; children: ReactNode }) => {
      const ctx = useContext(Ctx);
      return <button type="button" onClick={() => ctx.set(value)}>{children}</button>;
    },
    TabsContent: ({ value, children }: { value: string; children: ReactNode }) =>
      useContext(Ctx).value === value ? <div>{children}</div> : null,
  };
});
// the global confirmation dialog loads it early: react is imported here, not from the top of the file
vi.mock('@/components/ui/alert-dialog', async () => {
  const { createContext, useContext } = await import('react');
  const Ctx = createContext<(open: boolean) => void>(() => {});
  return {
    AlertDialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: ReactNode }) =>
      open ? <Ctx.Provider value={onOpenChange}><div role="alertdialog">{children}</div></Ctx.Provider> : null,
    AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    AlertDialogCancel: ({ children }: { children: ReactNode }) => {
      const onOpenChange = useContext(Ctx);
      return <button onClick={() => onOpenChange(false)}>{children}</button>;
    },
    AlertDialogAction: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => {
      const onOpenChange = useContext(Ctx);
      return <button onClick={() => { onClick(); onOpenChange(false); }}>{children}</button>;
    },
  };
});

const mocked = {
  update: vi.mocked(api.tournaments.update),
  invites: vi.mocked(api.tournaments.listInvites),
  tables: vi.mocked(api.tournaments.listTables),
  remove: vi.mocked(api.tournaments.delete),
  search: vi.mocked(api.users.search),
  assign: vi.mocked(api.roles.assign),
  revoke: vi.mocked(api.roles.revoke),
};

const tournament: Tournament = {
  id: 't1',
  slug: 'summer-cup',
  revision: 0,
  name: 'Summer Cup',
  location: 'Garden',
  description: 'Rules',
  start_time: '2026-07-01T18:00:00',
  registration_end_time: '2026-06-30T18:00:00',
  registration_auto_close: true,
  checkin_enabled: false,
  checkin_start_time: null,
  checkin_auto_open: false,
  started_at: null,
  finished_at: null,
  phase: 'registration',
  registration_open: true,
  checkin_open: false,
  mode: TournamentMode.SINGLE_ELIMINATION,
  visibility: TournamentVisibility.PUBLIC,
  join_policy: JoinPolicy.OPEN,
  is_deleted: false,
  created_by_id: 'u0',
  created_at: '',
  updated_at: '',
};

const roles: TournamentUserRole[] = [
  { id: 'r1', tournament_id: 't1', user_id: 'u1', user_name: 'Alice Admin', role: TournamentRoleType.ADMIN, assigned_at: '' },
  { id: 'r2', tournament_id: 't1', user_id: 'u2', user_name: 'Ref Reese', role: TournamentRoleType.REFEREE, assigned_at: '' },
  { id: 'r3', tournament_id: 't1', user_id: 'u3', role: TournamentRoleType.MANAGER, assigned_at: '' },
];

const onReload = vi.fn();

function setup(
  userRole: TournamentRoleType | null,
  overrides: Partial<Tournament> = {},
) {
  return render(
    <TournamentSettings
      tournament={{ ...tournament, ...overrides }}
      roles={roles}
      userRole={userRole}
      onReload={onReload}
    />,
  );
}

/** A card of the settings by its title, and the save button right in it. */
const card = (title: string) => screen.getByText(title, { selector: '[data-slot=card-title]' }).closest('[data-slot=card]') as HTMLElement;
const saveOf = (title: string) => within(card(title)).getByRole('button', { name: /speichern|Gespeichert/ });
const nameInput = () => screen.getByDisplayValue('Summer Cup');

beforeEach(() => {
  vi.clearAllMocks();
  onReload.mockResolvedValue(undefined);
  mocked.tables.mockResolvedValue([{ id: 'x1', name: 'Tisch 1', position: 1 }]);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
});
afterEach(() => cleanup());

describe('visibility per role', () => {
  it('shows everything to admins, grouped', () => {
    setup(TournamentRoleType.ADMIN);
    for (const title of ['Allgemein', 'Zeitplan', 'Tische', 'Link & Zugang', 'Rollen & Berechtigungen', 'Gefahrenzone']) {
      expect(screen.getByText(title, { selector: '[data-slot=card-title]' })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button').filter((b) => b.querySelector('.lucide-user-minus'))).toHaveLength(3);
    expect(screen.queryByText('Einladungslinks')).not.toBeInTheDocument(); // everybody may join
  });

  it('lets managers edit details but only revoke referees', () => {
    setup(TournamentRoleType.MANAGER);
    expect(card('Allgemein')).toBeInTheDocument();
    expect(screen.queryByText('Gefahrenzone')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button').filter((b) => b.querySelector('.lucide-user-minus'))).toHaveLength(1);
  });

  it.each([TournamentRoleType.REFEREE, null])('shows only the role list to %s', (role) => {
    setup(role);
    expect(screen.queryByText('Allgemein')).not.toBeInTheDocument();
    expect(screen.queryByText('Gefahrenzone')).not.toBeInTheDocument();
    expect(screen.getByText('Rollen & Berechtigungen')).toBeInTheDocument();
    expect(screen.getByText('Alice Admin')).toBeInTheDocument();
    expect(screen.getByText('u3')).toBeInTheDocument(); // falls back to the user id
  });
});

describe('after the start', () => {
  const started = { started_at: '2026-07-01T18:05:00', phase: 'running' as const, registration_open: false };

  it('hides what only matters before the start: schedule, who may join, invitation links', () => {
    setup(TournamentRoleType.ADMIN, { ...started, join_policy: JoinPolicy.INVITE_ONLY });
    expect(screen.queryByText('Zeitplan', { selector: '[data-slot=card-title]' })).not.toBeInTheDocument();
    expect(screen.queryByText('Beitreten')).not.toBeInTheDocument();
    expect(screen.queryByText('Einladungslinks')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Adresse')).toBeInTheDocument();
    expect(screen.getByText('Ergebnisse sehen')).toBeInTheDocument();
  });

  it('does not send who may join any more', async () => {
    mocked.update.mockResolvedValue(tournament);
    setup(TournamentRoleType.ADMIN, started);
    fireEvent.click(screen.getByText('Privat', { selector: 'span' }));
    fireEvent.click(saveOf('Link & Zugang'));
    await waitFor(() => expect(mocked.update).toHaveBeenCalled());
    expect(mocked.update.mock.calls[0][1]).toEqual({ slug: 'summer-cup', visibility: 'private' });
  });
});

describe('editing the tournament: each card saves its own fields', () => {
  it('starts clean and enables saving after a change in that card only', () => {
    setup(TournamentRoleType.ADMIN);
    const name = nameInput();
    expect(saveOf('Allgemein')).toHaveTextContent('Gespeichert');
    expect(saveOf('Allgemein')).toBeDisabled();

    fireEvent.change(name, { target: { value: 'Winter Cup' } });
    expect(saveOf('Allgemein')).toHaveTextContent('Allgemein speichern');
    expect(saveOf('Allgemein')).toBeEnabled();
    expect(saveOf('Zeitplan')).toBeDisabled();

    fireEvent.change(name, { target: { value: '  ' } });
    expect(saveOf('Allgemein')).toBeDisabled();
  });

  it.each([
    ['location', 'Allgemein', () => screen.getByDisplayValue('Garden'), 'Beach'],
    ['start time', 'Zeitplan', () => screen.getByDisplayValue('2026-07-01T18:00'), '2026-07-02T18:00'],
    ['registration end', 'Zeitplan', () => screen.getByDisplayValue('2026-06-30T18:00'), '2026-06-29T18:00'],
  ])('marks %s changes as dirty', (_name, title, field, value) => {
    setup(TournamentRoleType.ADMIN);
    fireEvent.change(field(), { target: { value } });
    expect(saveOf(title)).toBeEnabled();
  });

  it('marks check-in, description and visibility changes as dirty', () => {
    setup(TournamentRoleType.ADMIN);
    const checkinSwitch = screen.getByRole('switch', { name: 'Check-in vor Ort' });
    fireEvent.click(checkinSwitch);
    expect(saveOf('Zeitplan')).toBeEnabled();
    fireEvent.click(checkinSwitch);
    expect(saveOf('Zeitplan')).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Turnier-Regeln/), { target: { value: 'New rules' } });
    expect(saveOf('Allgemein')).toBeEnabled();
    fireEvent.change(screen.getByPlaceholderText(/Turnier-Regeln/), { target: { value: 'Rules' } });
    expect(saveOf('Allgemein')).toBeDisabled();

    fireEvent.click(screen.getByText('Privat', { selector: 'span' }));
    expect(saveOf('Link & Zugang')).toBeEnabled();
  });

  it('saves the general fields and reloads', async () => {
    mocked.update.mockResolvedValue(tournament);
    setup(TournamentRoleType.ADMIN);
    fireEvent.change(nameInput(), { target: { value: 'Winter Cup' } });
    fireEvent.change(screen.getByDisplayValue('Garden'), { target: { value: '' } });
    fireEvent.click(saveOf('Allgemein'));

    await waitFor(() => expect(onReload).toHaveBeenCalled());
    expect(mocked.update).toHaveBeenCalledWith('t1', { name: 'Winter Cup', location: undefined, description: 'Rules' });
    expect(toast.success).toHaveBeenCalledWith('Gespeichert');
  });

  it('saves the schedule with the converted values', async () => {
    mocked.update.mockResolvedValue(tournament);
    setup(TournamentRoleType.ADMIN);
    fireEvent.change(screen.getByDisplayValue('2026-06-30T18:00'), { target: { value: '' } });
    fireEvent.click(saveOf('Zeitplan'));

    await waitFor(() => expect(mocked.update).toHaveBeenCalled());
    expect(mocked.update).toHaveBeenCalledWith('t1', {
      start_time: new Date('2026-07-01T18:00').toISOString(),
      registration_end_time: null,
      registration_auto_close: false,
      checkin_enabled: false,
      checkin_start_time: null,
      checkin_auto_open: false,
    });
  });

  it('saves access: address, visibility and who may join', async () => {
    mocked.update.mockResolvedValue(tournament);
    setup(TournamentRoleType.ADMIN);
    fireEvent.click(screen.getByText('Privat', { selector: 'span' }));
    fireEvent.click(screen.getByText('Nur mit Einladungslink', { selector: 'span' }));
    fireEvent.click(saveOf('Link & Zugang'));
    await waitFor(() => expect(mocked.update).toHaveBeenCalled());
    expect(mocked.update.mock.calls[0][1]).toEqual({ slug: 'summer-cup', visibility: 'private', join_policy: 'invite_only' });
  });

  it('omits an emptied description', async () => {
    mocked.update.mockResolvedValue(tournament);
    setup(TournamentRoleType.ADMIN, { description: null });
    fireEvent.change(nameInput(), { target: { value: 'X' } });
    fireEvent.click(saveOf('Allgemein'));
    await waitFor(() => expect(mocked.update).toHaveBeenCalled());
    expect(mocked.update.mock.calls[0][1]).toMatchObject({ description: undefined });
  });

  it('requires a start time', () => {
    setup(TournamentRoleType.ADMIN);
    fireEvent.change(screen.getByDisplayValue('2026-07-01T18:00'), { target: { value: '' } });
    expect(saveOf('Zeitplan')).toBeDisabled();
  });

  it('explains an impossible schedule and blocks saving', () => {
    setup(TournamentRoleType.ADMIN);
    fireEvent.change(screen.getByDisplayValue('2026-06-30T18:00'), { target: { value: '2026-07-02T18:00' } });
    expect(screen.getByText('Der Anmeldeschluss muss vor dem Turnierstart liegen.')).toBeInTheDocument();
    expect(saveOf('Zeitplan')).toBeDisabled();
  });

  it('saves check-in settings', async () => {
    mocked.update.mockResolvedValue(tournament);
    setup(TournamentRoleType.ADMIN);
    fireEvent.click(screen.getByRole('switch', { name: 'Check-in vor Ort' }));
    fireEvent.change(screen.getByLabelText('Check-in ab'), { target: { value: '2026-07-01T17:00' } });
    fireEvent.click(saveOf('Zeitplan'));
    await waitFor(() => expect(mocked.update).toHaveBeenCalled());
    expect(mocked.update.mock.calls[0][1]).toMatchObject({
      checkin_enabled: true,
      checkin_start_time: new Date('2026-07-01T17:00').toISOString(),
      checkin_auto_open: true,
    });
  });

  it('lets the schedule act only if the organizer wants it: a switch behind each time', async () => {
    mocked.update.mockResolvedValue(tournament);
    setup(TournamentRoleType.ADMIN);
    const closeSwitch = screen.getByRole('switch', { name: 'Anmeldung zu dieser Zeit automatisch schließen' });
    expect(closeSwitch).toBeChecked();

    fireEvent.click(closeSwitch);
    fireEvent.click(saveOf('Zeitplan'));
    await waitFor(() => expect(mocked.update).toHaveBeenCalled());
    expect(mocked.update.mock.calls[0][1]).toMatchObject({
      registration_end_time: new Date('2026-06-30T18:00').toISOString(),
      registration_auto_close: false,
    });
  });

  it('cannot automate without a time and says so', () => {
    setup(TournamentRoleType.ADMIN);
    fireEvent.change(screen.getByDisplayValue('2026-06-30T18:00'), { target: { value: '' } });
    const closeSwitch = screen.getByRole('switch', { name: /erst mit Datum möglich/ });
    expect(closeSwitch).toHaveAttribute('data-disabled');
    expect(closeSwitch).not.toBeChecked();
  });

  it('changes the address and follows it to the new page', async () => {
    mocked.update.mockResolvedValue({ ...tournament, slug: 'winter-cup' });
    setup(TournamentRoleType.ADMIN);
    expect(screen.getByText('So lautet der Link zum Turnier.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Adresse'), { target: { value: 'Winter-Cup' } });
    expect(screen.getByText(/Der alte Link und QR-Codes .* funktionieren dann nicht mehr/)).toBeInTheDocument();
    fireEvent.click(saveOf('Link & Zugang'));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/t/winter-cup'));
    expect(mocked.update.mock.calls[0][1]).toMatchObject({ slug: 'winter-cup' });
  });

  it('names a taken or invalid address at the field', async () => {
    mocked.update.mockRejectedValue(new ApiError(409, { detail: 'Diese Adresse ist schon vergeben.', error_code: 'SLUG_TAKEN' }));
    setup(TournamentRoleType.ADMIN);
    fireEvent.change(screen.getByLabelText('Adresse'), { target: { value: 'vergeben' } });
    fireEvent.click(saveOf('Link & Zugang'));

    expect(await screen.findByText('Diese Adresse ist schon vergeben.')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the saving state and reports failures', async () => {
    let reject!: (e: unknown) => void;
    mocked.update.mockReturnValue(new Promise((_, r) => (reject = r)));
    setup(TournamentRoleType.ADMIN);
    fireEvent.change(nameInput(), { target: { value: 'Winter Cup' } });
    fireEvent.click(saveOf('Allgemein'));

    expect(await screen.findByText('Wird gespeichert...')).toBeDisabled();
    reject(new Error('Das hat nicht geklappt.'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Das hat nicht geklappt.'));
  });

  it('previews the description as markdown', () => {
    setup(TournamentRoleType.ADMIN);
    fireEvent.click(screen.getByText('Vorschau'));
    expect(screen.getByTestId('markdown')).toHaveTextContent('Rules');
    fireEvent.click(screen.getByText('Bearbeiten'));
    expect(screen.getByPlaceholderText(/Turnier-Regeln/)).toBeInTheDocument();
  });

  it('previews an empty description with a placeholder', () => {
    setup(TournamentRoleType.ADMIN, { description: null });
    fireEvent.click(screen.getByText('Vorschau'));
    expect(screen.getByText('Keine Beschreibung...')).toBeInTheDocument();
  });
});

describe('tables', () => {
  it('are managed by organisers, one card each', async () => {
    mocked.tables.mockResolvedValue([
      { id: 'x1', name: 'Tisch 1', position: 1 },
      { id: 'x2', name: 'Terrasse', position: 2 },
    ]);
    setup(TournamentRoleType.MANAGER);
    expect(await screen.findByText('Terrasse')).toBeInTheDocument();
    expect(screen.getByText('Tisch 1')).toBeInTheDocument();
    expect(mocked.tables).toHaveBeenCalledWith('t1');
    expect(screen.queryByText('Anzahl Tische')).not.toBeInTheDocument(); // no number to type any more
  });

  it('are not shown to referees', () => {
    setup(TournamentRoleType.REFEREE);
    expect(screen.queryByRole('button', { name: 'Tisch hinzufügen' })).not.toBeInTheDocument();
    expect(mocked.tables).not.toHaveBeenCalled();
  });
});

describe('invitation links', () => {
  const inviteOnly = { join_policy: JoinPolicy.INVITE_ONLY };

  beforeEach(() => mocked.invites.mockResolvedValue([]));

  it('are managed by organisers when joining needs an invitation', async () => {
    setup(TournamentRoleType.MANAGER, inviteOnly);
    expect(await screen.findByText('Einladungslinks')).toBeInTheDocument();
    expect(mocked.invites).toHaveBeenCalledWith('t1');
  });

  it('are not offered to referees, nor when everybody may join', () => {
    setup(TournamentRoleType.REFEREE, inviteOnly);
    expect(screen.queryByText('Einladungslinks')).not.toBeInTheDocument();
    cleanup();
    setup(TournamentRoleType.ADMIN);
    expect(screen.queryByText('Einladungslinks')).not.toBeInTheDocument();
  });
});

describe('role management', () => {
  const alice = { id: 'u9', name: 'Zed Zimmer' } as User;
  const searchInput = () => screen.getByPlaceholderText('Nutzername suchen...');
  const searchButton = () => document.querySelector('.lucide-search')!.closest('button')!;

  it('requires two characters before searching', () => {
    setup(TournamentRoleType.ADMIN);
    fireEvent.change(searchInput(), { target: { value: 'z' } });
    expect(searchButton()).toBeDisabled();
    fireEvent.keyDown(searchInput(), { key: 'Enter' });
    expect(mocked.search).not.toHaveBeenCalled();
  });

  it('searches via button and via Enter, ignoring other keys', async () => {
    mocked.search.mockResolvedValue([alice]);
    setup(TournamentRoleType.ADMIN);
    fireEvent.change(searchInput(), { target: { value: 'ze' } });
    fireEvent.keyDown(searchInput(), { key: 'a' });
    expect(mocked.search).not.toHaveBeenCalled();

    fireEvent.click(searchButton());
    expect(await screen.findByText('Zed Zimmer')).toBeInTheDocument();

    fireEvent.keyDown(searchInput(), { key: 'Enter' });
    await waitFor(() => expect(mocked.search).toHaveBeenCalledTimes(2));
  });

  it('reports search failures', async () => {
    mocked.search.mockRejectedValue(new Error('x'));
    setup(TournamentRoleType.ADMIN);
    fireEvent.change(searchInput(), { target: { value: 'ze' } });
    fireEvent.click(searchButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Fehler bei der Suche'));
  });

  it('assigns the chosen role to the chosen user', async () => {
    mocked.search.mockResolvedValue([alice]);
    mocked.assign.mockResolvedValue(roles[0]);
    setup(TournamentRoleType.ADMIN);
    fireEvent.change(searchInput(), { target: { value: 'ze' } });
    fireEvent.click(searchButton());
    await screen.findByText('Zed Zimmer');

    const assign = screen.getByRole('button', { name: /Zuweisen/ });
    expect(assign).toBeDisabled();
    fireEvent.click(screen.getByText('Zed Zimmer'));
    expect(assign).toBeEnabled();
    fireEvent.click(screen.getByText('Manager'));
    fireEvent.click(assign);

    await waitFor(() => expect(mocked.assign).toHaveBeenCalledWith('t1', 'u9', 'manager'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Rolle erfolgreich zugewiesen!'));
    expect(onReload).toHaveBeenCalled();
    expect(screen.queryByText('Zed Zimmer')).not.toBeInTheDocument(); // search reset
  });

  it('assigns the default referee role and offers only the allowed roles', async () => {
    mocked.search.mockResolvedValue([alice]);
    mocked.assign.mockResolvedValue(roles[1]);
    setup(TournamentRoleType.MANAGER);
    fireEvent.change(searchInput(), { target: { value: 'ze' } });
    fireEvent.click(searchButton());
    await screen.findByText('Zed Zimmer');

    expect(within(document.body).queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Manager')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Zed Zimmer'));
    fireEvent.click(screen.getByText('Schiedsrichter'));
    fireEvent.click(screen.getByRole('button', { name: /Zuweisen/ }));
    await waitFor(() => expect(mocked.assign).toHaveBeenCalledWith('t1', 'u9', 'referee'));
  });

  it.each([
    [new Error('Schon vergeben'), 'Schon vergeben'],
    ['boom', 'Fehler'],
  ])('reports assignment failures (%s)', async (error, message) => {
    mocked.search.mockResolvedValue([alice]);
    mocked.assign.mockRejectedValue(error);
    setup(TournamentRoleType.ADMIN);
    fireEvent.change(searchInput(), { target: { value: 'ze' } });
    fireEvent.click(searchButton());
    await screen.findByText('Zed Zimmer');
    fireEvent.click(screen.getByText('Zed Zimmer'));
    fireEvent.click(screen.getByRole('button', { name: /Zuweisen/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
  });

  const revokeButtons = () =>
    screen.getAllByRole('button').filter((b) => b.querySelector('.lucide-user-minus'));

  it('revokes a role after a confirmation that names the consequence', async () => {
    mocked.revoke.mockResolvedValue(undefined);
    setup(TournamentRoleType.ADMIN);
    fireEvent.click(revokeButtons()[1]);
    expect(screen.getByText('Rolle entziehen?')).toBeInTheDocument();
    expect(screen.getByText('Ref Reese kann das Turnier danach nicht mehr als Schiedsrichter leiten.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rolle entziehen' }));

    await waitFor(() => expect(mocked.revoke).toHaveBeenCalledWith('t1', 'r2'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Rolle entzogen.'));
    expect(onReload).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('can cancel the confirmation', () => {
    setup(TournamentRoleType.ADMIN);
    fireEvent.click(revokeButtons()[0]);
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mocked.revoke).not.toHaveBeenCalled();
  });

  it.each([
    [new Error('Nicht erlaubt'), 'Nicht erlaubt'],
    ['boom', 'Das hat nicht geklappt. Versuch es noch einmal.'],
  ])('shows a failed revoke in the dialog (%s)', async (error, message) => {
    mocked.revoke.mockRejectedValue(error);
    setup(TournamentRoleType.ADMIN);
    fireEvent.click(revokeButtons()[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Rolle entziehen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument(); // stays open to try again or cancel
  });
});

describe('deleting the tournament', () => {
  const open = () => {
    setup(TournamentRoleType.ADMIN);
    fireEvent.click(screen.getByText('Turnier endgültig löschen'));
  };

  it('deletes after a confirmation that names the consequences and leaves the page', async () => {
    mocked.remove.mockResolvedValue(undefined);
    open();
    expect(screen.getByText('Summer Cup löschen?')).toBeInTheDocument();
    expect(screen.getByText(/lässt sich nicht rückgängig machen/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Turnier löschen' }));

    await waitFor(() => expect(mocked.remove).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/tournaments'));
    expect(toast.success).toHaveBeenCalledWith('Turnier gelöscht.');
  });

  it('keeps the dialog open with the reason when deleting fails', async () => {
    mocked.remove.mockRejectedValue(new Error('Das Turnier läuft noch.'));
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Turnier löschen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Turnier läuft noch.');
    expect(push).not.toHaveBeenCalled();
  });
});
