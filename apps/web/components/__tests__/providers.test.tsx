import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryProvider } from '../query-provider';
import { ThemeProvider } from '../theme-provider';
import { UserProvider, useCurrentUser } from '../user-provider';
import { clearTokens, setTokens } from '@/lib/auth';
import { api } from '@/lib/api';
import type { User } from '@/types';

vi.mock('@/lib/api', () => ({ api: { users: { me: vi.fn() } } }));

const me = vi.mocked(api.users.me);
const aUser = { id: 'u1', name: 'Ada', is_system_admin: false } as User;

function Probe() {
  const { user, isLoading, reload } = useCurrentUser();
  return (
    <div>
      <span data-testid="state">{isLoading ? 'loading' : (user?.name ?? 'anonymous')}</span>
      <button onClick={() => void reload()}>reload</button>
    </div>
  );
}

describe('UserProvider', () => {
  beforeEach(() => {
    me.mockReset();
    clearTokens();
  });

  it('stays anonymous without an access token', async () => {
    render(<UserProvider><Probe /></UserProvider>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
    expect(me).not.toHaveBeenCalled();
  });

  it('loads the current user when logged in', async () => {
    setTokens('a', 'r');
    me.mockResolvedValue(aUser);
    render(<UserProvider><Probe /></UserProvider>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('Ada'));
  });

  it('falls back to anonymous when loading fails and can reload', async () => {
    setTokens('a', 'r');
    me.mockRejectedValueOnce(new Error('boom'));
    render(<UserProvider><Probe /></UserProvider>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));

    me.mockResolvedValue(aUser);
    screen.getByText('reload').click();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('Ada'));
  });

  it('exposes a loading default context without provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    screen.getByText('reload').click();
  });
});

describe('QueryProvider', () => {
  it('provides a query client with a one minute stale time', () => {
    function Reader() {
      const staleTime = useQueryClient().getDefaultOptions().queries?.staleTime;
      return <p>stale:{String(staleTime)}</p>;
    }
    render(<QueryProvider><Reader /></QueryProvider>);
    expect(screen.getByText('stale:60000')).toBeInTheDocument();
  });
});

describe('ThemeProvider', () => {
  it('renders its children', () => {
    render(<ThemeProvider attribute="class"><p>themed</p></ThemeProvider>);
    expect(screen.getByText('themed')).toBeInTheDocument();
  });
});
