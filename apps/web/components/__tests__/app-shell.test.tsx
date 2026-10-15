import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AppShell } from '../app-shell';
import { clearTokens, setTokens } from '@/lib/auth';

const usePathname = vi.fn();
const useCurrentUser = vi.fn();

vi.mock('next/navigation', () => ({ usePathname: () => usePathname() }));
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));
vi.mock('../user-provider', () => ({ useCurrentUser: () => useCurrentUser() }));
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
  });
  afterEach(() => vi.unstubAllGlobals());

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

  it('shows no login link while it is not yet known whether somebody is logged in', () => {
    useCurrentUser.mockReturnValue({ user: null, isLoading: true })
    render(<AppShell>x</AppShell>)
    expect(screen.queryByText('Anmelden')).not.toBeInTheDocument()
  })

  it('logs out: clears tokens and goes to the login', () => {
    const location = { href: '/teams' };
    vi.stubGlobal('location', location);
    setTokens('a', 'r');

    render(<AppShell>x</AppShell>);
    fireEvent.click(screen.getByText('Abmelden'));

    expect(location.href).toBe('/login');
    expect(localStorage.getItem('beerpong_access_token')).toBeNull();
    clearTokens();
  });
});
