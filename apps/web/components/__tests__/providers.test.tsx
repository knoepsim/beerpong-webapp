import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { QueryProvider } from '../query-provider';
import { ThemeProvider } from '../theme-provider';
import { useCurrentUser } from '@/hooks/queries/user';
import { testQueryClient } from '@/lib/test-fixtures/render';
import { api, ApiError, NetworkError } from '@/lib/api';
import type { User } from '@/types';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { users: { me: vi.fn() } },
}));

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

const renderProbe = () =>
  render(
    <QueryClientProvider client={testQueryClient()}>
      <Probe />
    </QueryClientProvider>,
  );

describe('useCurrentUser', () => {
  beforeEach(() => {
    me.mockReset();
  });

  it('is anonymous for a visitor without a session, who is asked as a guest (no redirect to the login)', async () => {
    me.mockRejectedValue(new ApiError(401, { detail: 'Not authenticated' }));
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
    expect(me).toHaveBeenCalledWith({ guest: true });
  });

  it('loads the current user when logged in', async () => {
    me.mockResolvedValue(aUser);
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('Ada'));
  });

  it('can load again', async () => {
    me.mockRejectedValueOnce(new ApiError(401, {}));
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));

    me.mockResolvedValue(aUser);
    screen.getByText('reload').click();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('Ada'));
  });

  it('keeps the user it knows when the network fails, and asks again when it is back', async () => {
    me.mockResolvedValueOnce(aUser);
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('Ada'));

    me.mockRejectedValueOnce(new NetworkError());
    screen.getByText('reload').click();
    await waitFor(() => expect(me).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('state')).toHaveTextContent('Ada');

    me.mockResolvedValue({ ...aUser, name: 'Ada Neu' });
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('Ada Neu'));
  });
});

describe('QueryProvider', () => {
  it('provides the query client of the app with a one minute stale time', () => {
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
