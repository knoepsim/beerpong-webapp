import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError, api, request } from './api';

type FakeResponse = { ok: boolean; status: number; statusText?: string; json?: () => Promise<unknown> };

const fetchMock = vi.fn();

const ok = (body: unknown = {}, status = 200): FakeResponse => ({
  ok: true,
  status,
  json: async () => body,
});
const fail = (status: number, body: unknown): FakeResponse => ({
  ok: false,
  status,
  statusText: 'Status Text',
  json: async () => body,
});

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiError', () => {
  it('uses a string detail as message', () => {
    expect(new ApiError(400, { detail: 'Invalid input' }).message).toBe('Invalid input');
  });

  it('joins validation error messages', () => {
    const err = new ApiError(422, { detail: [{ msg: 'a' }, { msg: 'b' }] });
    expect(err.message).toBe('a, b');
    expect(err.status).toBe(422);
  });

  it('hides the validation prefix from users', () => {
    const err = new ApiError(422, { detail: [{ msg: 'Value error, Nur deutsche Handynummern' }] });
    expect(err.message).toBe('Nur deutsche Handynummern');
  });

  it('falls back to a generic message', () => {
    expect(new ApiError(500, {}).message).toBe('Ein Fehler ist aufgetreten');
  });
});

describe('request', () => {
  it('sends the session cookies and the header that marks our own pages, no token', async () => {
    fetchMock.mockResolvedValue(ok({ fine: true }));

    await expect(request('/thing')).resolves.toEqual({ fine: true });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/thing$/);
    expect(options.credentials).toBe('include');
    expect((options.headers as Headers).get('X-Requested-With')).toBe('fetch');
    expect((options.headers as Headers).has('Authorization')).toBe(false);
    expect(options.cache).toBe('no-store');
  });

  it('normalises endpoints without a leading slash and keeps given headers/cache', async () => {
    fetchMock.mockResolvedValue(ok());
    await request('thing', { headers: { 'X-Test': '1' }, cache: 'force-cache' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/thing$/);
    expect((options.headers as Headers).get('X-Test')).toBe('1');
    expect(options.cache).toBe('force-cache');
  });

  it('throws an ApiError with the server detail', async () => {
    fetchMock.mockResolvedValue(fail(400, { detail: 'Invalid input' }));
    await expect(request('/x')).rejects.toMatchObject({ status: 400, message: 'Invalid input' });
  });

  it('falls back to the status text when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new Error('no json');
      },
    });
    await expect(request('/x')).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' });
  });

  it('returns an empty object for 204 No Content', async () => {
    fetchMock.mockResolvedValue(ok(undefined, 204));
    await expect(request('/x')).resolves.toEqual({});
  });
});

describe('request: expired access token', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.stubGlobal('location', {
      pathname: '/teams',
      search: '?page=2',
      origin: 'http://localhost:3000',
      href: 'http://localhost:3000/teams?page=2',
    });
  });

  afterEach(() => {
    vi.stubGlobal('location', originalLocation);
  });

  it('renews the session with the refresh cookie and retries the request once', async () => {
    fetchMock
      .mockResolvedValueOnce(fail(401, {})) // the access token expired
      .mockResolvedValueOnce(fail(401, {})) // still (the check whether another tab renewed it)
      .mockResolvedValueOnce(ok(undefined, 204)) // POST /auth/refresh
      .mockResolvedValueOnce(ok({ data: 1 }));

    await expect(request('/secure')).resolves.toEqual({ data: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const [url, options] = fetchMock.mock.calls[2];
    expect(url).toMatch(/\/auth\/refresh$/);
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(options.headers).toEqual({ 'X-Requested-With': 'fetch' });
  });

  it('does not renew when another tab did it meanwhile: the second try already works', async () => {
    fetchMock.mockResolvedValueOnce(fail(401, {})).mockResolvedValueOnce(ok({ data: 2 }));

    await expect(request('/secure')).resolves.toEqual({ data: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renews one at a time, in all tabs, when the browser can lock', async () => {
    const order: string[] = [];
    const locks = {
      request: vi.fn(async (_name: string, task: () => Promise<unknown>) => {
        order.push('lock');
        return task();
      }),
    };
    vi.stubGlobal('navigator', { locks });
    fetchMock.mockResolvedValueOnce(fail(401, {})).mockResolvedValueOnce(ok({ data: 3 }));

    await request('/secure');

    expect(locks.request).toHaveBeenCalledTimes(1);
    expect(locks.request.mock.calls[0][0]).toBe('beerpong-session');
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', fetchMock);
  });

  it.each([
    ['the refresh endpoint refuses', () => fetchMock.mockResolvedValueOnce(fail(401, {}))],
    ['the refresh endpoint forbids', () => fetchMock.mockResolvedValueOnce(fail(403, {}))],
  ])('goes to the login when %s: the session is over', async (_name, arrange) => {
    fetchMock.mockResolvedValueOnce(fail(401, {})).mockResolvedValueOnce(fail(401, {}));
    arrange();

    // The request never settles because the browser is navigating away.
    void request('/secure');
    await vi.waitFor(() =>
      expect(window.location.href).toBe('/login?redirect=%2Fteams%3Fpage%3D2'),
    );
  });

  it.each([
    ['the refresh request cannot be sent', () => fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))],
    ['the refresh endpoint is down', () => fetchMock.mockResolvedValueOnce(fail(502, {}))],
    ['the refresh endpoint fails', () => fetchMock.mockResolvedValueOnce(fail(500, {}))],
  ])('stays on the page and reports the connection when %s: that says nothing about the session', async (_name, arrange) => {
    fetchMock.mockResolvedValueOnce(fail(401, {})).mockResolvedValueOnce(fail(401, {}))
    arrange()

    await expect(request('/secure')).rejects.toBeInstanceOf(NetworkError)

    expect(window.location.href).toBe('http://localhost:3000/teams?page=2')
  })

  it('reports the connection in German when the request itself cannot be sent', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(request('/x')).rejects.toThrow('Keine Verbindung zum Server')
  })

  it('lets a deliberate abort through unchanged', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
    await expect(request('/x')).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('goes to the login when the retried request is still unauthorized', async () => {
    fetchMock
      .mockResolvedValueOnce(fail(401, {}))
      .mockResolvedValueOnce(fail(401, {}))
      .mockResolvedValueOnce(ok(undefined, 204))
      .mockResolvedValueOnce(fail(401, {}));

    void request('/secure');
    await vi.waitFor(() => expect(window.location.href).toContain('/login?redirect='));
  });

  it('answers a guest request with the error instead of going to the login', async () => {
    fetchMock.mockResolvedValue(fail(401, { detail: 'Not authenticated' }));

    await expect(request('/users/me', { guest: true })).rejects.toMatchObject({ status: 401 });

    expect(window.location.href).toBe('http://localhost:3000/teams?page=2');
  });
});

describe('api endpoints', () => {
  const tournamentBody = { name: 'Cup' };

  // [call, expected method, expected path, expected JSON body]
  const cases: Array<[string, () => Promise<unknown>, string, string, unknown]> = [
    ['auth.requestCode', () => api.auth.requestCode('+49123'), 'POST', '/auth/request-code', { phone_number: '+49123' }],
    ['auth.verify', () => api.auth.verify('+49123', '123456'), 'POST', '/auth/verify', { phone_number: '+49123', code: '123456', cookie_session: true }],
    ['auth.logout', () => api.auth.logout(), 'POST', '/auth/logout', undefined],
    ['users.me', () => api.users.me(), 'GET', '/users/me', undefined],
    ['users.updateMe', () => api.users.updateMe({ name: 'N' }), 'PATCH', '/users/me', { name: 'N' }],
    ['users.search', () => api.users.search('a b'), 'GET', '/users/search?query=a%20b', undefined],
    ['users.requestPhoneChange', () => api.users.requestPhoneChange('+49'), 'POST', '/users/me/phone/request', { new_phone_number: '+49' }],
    ['users.verifyPhoneChange', () => api.users.verifyPhoneChange('+49', '1'), 'POST', '/users/me/phone/verify', { new_phone_number: '+49', code: '1' }],
    ['teams.list', () => api.teams.list(), 'GET', '/teams', undefined],
    ['teams.get', () => api.teams.get('t1'), 'GET', '/teams/t1', undefined],
    ['teams.create', () => api.teams.create('Team'), 'POST', '/teams', { name: 'Team' }],
    ['teams.update', () => api.teams.update('t1', 'New'), 'PATCH', '/teams/t1', { name: 'New' }],
    ['teams.delete', () => api.teams.delete('t1'), 'DELETE', '/teams/t1', undefined],
    ['teams.createInvite', () => api.teams.createInvite('t1'), 'POST', '/teams/t1/invite', undefined],
    ['teams.getInviteDetails', () => api.teams.getInviteDetails('tok'), 'GET', '/teams/invite/tok', undefined],
    ['teams.acceptInvite', () => api.teams.acceptInvite('tok'), 'POST', '/teams/join/tok', undefined],
    ['tournaments.getMyTournaments', () => api.tournaments.getMyTournaments(), 'GET', '/tournaments/me', undefined],
    ['tournaments.get', () => api.tournaments.get('x'), 'GET', '/tournaments/x', undefined],
    ['tournaments.getBySlug', () => api.tournaments.getBySlug('my-cup'), 'GET', '/tournaments/by-slug/my-cup', undefined],
    ['tournaments.getPreview', () => api.tournaments.getPreview('my-cup'), 'GET', '/tournaments/by-slug/my-cup/preview', undefined],
    ['tournaments.listInvites', () => api.tournaments.listInvites('x'), 'GET', '/tournaments/x/invites', undefined],
    ['tournaments.createInvite', () => api.tournaments.createInvite('x', 'WhatsApp'), 'POST', '/tournaments/x/invites', { label: 'WhatsApp' }],
    ['tournaments.createInvite (no name)', () => api.tournaments.createInvite('x'), 'POST', '/tournaments/x/invites', { label: null }],
    ['tournaments.deleteInvite', () => api.tournaments.deleteInvite('x', 'i1'), 'DELETE', '/tournaments/x/invites/i1', undefined],
    ['invites.get', () => api.invites.get('abc1234'), 'GET', '/invites/abc1234', undefined],
    ['tournaments.create', () => api.tournaments.create(tournamentBody as never), 'POST', '/tournaments', tournamentBody],
    ['tournaments.update', () => api.tournaments.update('x', tournamentBody as never), 'PATCH', '/tournaments/x', tournamentBody],
    ['tournaments.delete', () => api.tournaments.delete('x'), 'DELETE', '/tournaments/x', undefined],
    ['tournaments.join', () => api.tournaments.join('x', 't1', 'inv'), 'POST', '/tournaments/x/join', { team_id: 't1', invite_token: 'inv' }],
    ['tournaments.leave', () => api.tournaments.leave('x'), 'DELETE', '/tournaments/x/leave', undefined],
    ['tournaments.removeTeam', () => api.tournaments.removeTeam('x', 't1'), 'DELETE', '/tournaments/x/teams/t1', undefined],
    ['tournaments.startTournament', () => api.tournaments.startTournament('x'), 'POST', '/tournaments/x/start', undefined],
    ['tournaments.getBracket', () => api.tournaments.getBracket('x'), 'GET', '/tournaments/x/bracket', undefined],
    ['tournaments.getTeams', () => api.tournaments.getTeams('x'), 'GET', '/tournaments/x/teams', undefined],
    ['tournaments.checkin', () => api.tournaments.checkin('x', 't1', true), 'POST', '/tournaments/x/teams/t1/checkin', { is_checked_in: true }],
    ['roles.list', () => api.roles.list('x'), 'GET', '/tournaments/x/roles', undefined],
    ['roles.assign', () => api.roles.assign('x', 'u1', 'manager'), 'POST', '/tournaments/x/roles', { user_id: 'u1', role: 'manager' }],
    ['roles.revoke', () => api.roles.revoke('x', 'r1'), 'DELETE', '/tournaments/x/roles/r1', undefined],
    ['results.list', () => api.results.list('m1'), 'GET', '/matches/m1/results', undefined],
    ['results.create', () => api.results.create('m1', 't1', 3), 'POST', '/matches/m1/results', { winner_team_id: 't1', cups_left: 3 }],
    ['results.modify', () => api.results.modify('m1', 't1', 2), 'PATCH', '/matches/m1/results', { winner_team_id: 't1', cups_left: 2 }],
    ['results.delete', () => api.results.delete('m1'), 'DELETE', '/matches/m1/results', undefined],
  ];

  it.each(cases)('%s', async (_name, call, method, path, body) => {
    fetchMock.mockResolvedValue(ok({}));
    await call();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url.endsWith(path)).toBe(true);
    expect(options.method ?? 'GET').toBe(method);
    if (body === undefined) {
      expect(options.body).toBeUndefined();
    } else {
      expect(JSON.parse(options.body as string)).toEqual(body);
    }
  });
});
