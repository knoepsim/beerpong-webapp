import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AppShell } from '../app-shell';

const usePathname = vi.fn();
const useCurrentUser = vi.fn();
const useMyInvitations = vi.fn();
const useMyTournaments = vi.fn();

vi.mock('next/navigation', () => ({ usePathname: () => usePathname() }));
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));
vi.mock('@/hooks/queries/user', () => ({ useCurrentUser: () => useCurrentUser() }));
vi.mock('@/hooks/queries/invitations', () => ({ useMyInvitations: () => useMyInvitations() }));
vi.mock('@/hooks/queries/tournaments', () => ({ useMyTournaments: () => useMyTournaments() }));
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <div role="menuitem" onClick={onClick}>{children}</div>
  ),
}));

describe('AppShell', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/teams');
    useCurrentUser.mockReturnValue({ user: { name: 'Ada', is_system_admin: false } });
    useMyInvitations.mockReturnValue({ data: [] });
    useMyTournaments.mockReturnValue({ data: undefined });
  });

  it('marks "Turniere" with a dot while an invitation waits, and keeps it active on an invitation', () => {
    useMyInvitations.mockReturnValue({ data: [{ id: 'i1' }, { id: 'i2' }] });
    usePathname.mockReturnValue('/invitations/i1');
    render(<AppShell><p>content</p></AppShell>);

    expect(screen.getAllByText('Offene Einladung')).toHaveLength(2); // desktop + mobile, no number
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: /Turniere/ })) {
      expect(link.className).toMatch(/text-primary/);
    }
  });

  it('marks "Turniere" while a tournament of mine runs, and not without', () => {
    const running = { tournament: { id: 't1', started_at: '2026-10-17T18:00:00Z', finished_at: null } };
    useMyTournaments.mockReturnValue({ data: { participating: [running], managing: [] } });
    const { unmount } = render(<AppShell><p>content</p></AppShell>);
    expect(screen.getAllByText('Turnier läuft')).toHaveLength(2);
    unmount();

    useMyTournaments.mockReturnValue({ data: { participating: [], managing: [] } });
    render(<AppShell><p>content</p></AppShell>);
    expect(screen.queryByText('Turnier läuft')).not.toBeInTheDocument();
  });

  it('renders navigation, user name and children', () => {
    render(<AppShell><p>content</p></AppShell>);

    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.getAllByText('Turniere')).toHaveLength(2); // desktop + mobile
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('highlights the active section', () => {
    render(<AppShell>x</AppShell>);
    const [desktopTeams] = screen.getAllByText('Teams');
    expect(desktopTeams.closest('a')?.className).toContain('text-primary');
    const [desktopTournaments] = screen.getAllByText('Turniere');
    expect(desktopTournaments.closest('a')?.className).toContain('text-muted-foreground');
  });

  it('shows the admin entry for system admins, active on /admin', () => {
    usePathname.mockReturnValue('/admin');
    useCurrentUser.mockReturnValue({ user: { name: 'Root', is_system_admin: true } });
    render(<AppShell>x</AppShell>);

    const admin = screen.getAllByText('Admin');
    expect(admin).toHaveLength(2);
    expect(admin[0].closest('a')?.className).toContain('text-primary');
  });

  it('shows the admin entry inactive on other pages', () => {
    useCurrentUser.mockReturnValue({ user: { name: 'Root', is_system_admin: true } });
    render(<AppShell>x</AppShell>);
    expect(screen.getAllByText('Admin')[0].closest('a')?.className).toContain('text-muted-foreground');
  });

  it('hides the user menu for anonymous visitors', () => {
    useCurrentUser.mockReturnValue({ user: null });
    render(<AppShell>x</AppShell>);
    expect(screen.queryByText('Abmelden')).not.toBeInTheDocument();
  });

  it('offers a visitor without login only the login, back to the page he is on, and no navigation', () => {
    usePathname.mockReturnValue('/t/sommerfest')
    useCurrentUser.mockReturnValue({ user: null, isLoading: false })
    const { container } = render(<AppShell>x</AppShell>)

    const login = screen.getByText('Anmelden')
    expect(login.closest('a')).toHaveAttribute('href', `/login?redirect=${encodeURIComponent('/t/sommerfest')}`)
    expect(container.querySelectorAll('nav.hidden, nav.md\:hidden.hidden').length).toBeGreaterThan(0)
  })

  it('leads from the logo to the start page', () => {
    useCurrentUser.mockReturnValue({ user: null, isLoading: false })
    render(<AppShell>x</AppShell>)
    expect(screen.getByRole('link', { name: 'MatchBase, Startseite' })).toHaveAttribute('href', '/')
  })

  it('shows no login link while it is not yet known whether somebody is logged in', () => {
    useCurrentUser.mockReturnValue({ user: null, isLoading: true })
    render(<AppShell>x</AppShell>)
    expect(screen.queryByText('Anmelden')).not.toBeInTheDocument()
  })

  it('logs out: ends the session on the server and goes to the start page', async () => {
    const location = { href: '/teams' };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    vi.stubGlobal('location', location);
    vi.stubGlobal('fetch', fetchMock);

    render(<AppShell>x</AppShell>);
    fireEvent.click(screen.getByText('Abmelden'));

    await waitFor(() => expect(location.href).toBe('/'));
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/logout$/);
  });
});
