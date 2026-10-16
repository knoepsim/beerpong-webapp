import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, request } from './api';
import { clearTokens, getAccessToken, setTokens } from './auth';

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
  clearTokens();
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
  it('adds the bearer token when logged in', async () => {
    setTokens('access', 'refresh');
    fetchMock.mockResolvedValue(ok({ fine: true }));

    await expect(request('/thing')).resolves.toEqual({ fine: true });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/thing$/);
    expect((options.headers as Headers).get('Authorization')).toBe('Bearer access');
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

  it('refreshes the token and retries the request once', async () => {
    setTokens('old', 'refresh');
    fetchMock
      .mockResolvedValueOnce(fail(401, {}))
      .mockResolvedValueOnce(ok({ access_token: 'new', refresh_token: 'refresh2' }))
      .mockResolvedValueOnce(ok({ data: 1 }));

    await expect(request('/secure')).resolves.toEqual({ data: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/auth\/refresh$/);
    expect((fetchMock.mock.calls[2][1].headers as Headers).get('Authorization')).toBe('Bearer new');
    expect(getAccessToken()).toBe('new');
  });

  it.each([
    ['refresh endpoint rejects', () => fetchMock.mockResolvedValueOnce(fail(401, {}))],
    ['refresh request throws', () => fetchMock.mockRejectedValueOnce(new Error('offline'))],
  ])('clears tokens and redirects to login when %s', async (_name, arrange) => {
    setTokens('old', 'refresh');
    fetchMock.mockResolvedValueOnce(fail(401, {}));
    arrange();

    // The request never settles because the browser is navigating away.
    void request('/secure');
    await vi.waitFor(() =>
      expect(window.location.href).toBe('/login?redirect=%2Fteams%3Fpage%3D2'),
    );
    expect(getAccessToken()).toBeNull();
  });

  it('redirects to login when the retried request is still unauthorized', async () => {
    setTokens('old', 'refresh');
    fetchMock
      .mockResolvedValueOnce(fail(401, {}))
      .mockResolvedValueOnce(ok({ access_token: 'new', refresh_token: 'r' }))
      .mockResolvedValueOnce(fail(401, {}));

    void request('/secure');
    await vi.waitFor(() => expect(window.location.href).toContain('/login?redirect='));
  });

  it('redirects without refreshing when there is no stored refresh token', async () => {
    fetchMock.mockResolvedValueOnce(fail(401, {}));
    void request('/secure');
    await vi.waitFor(() => expect(window.location.href).toContain('/login?redirect='));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('redirects without refreshing for anonymous 401 responses', async () => {
    setTokens('', 'refresh');
    fetchMock.mockResolvedValueOnce(fail(401, {}));
    void request('/secure');
    await vi.waitFor(() => expect(window.location.href).toContain('/login?redirect='));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('api endpoints', () => {
  const tournamentBody = { name: 'Cup' };

  // [call, expected method, expected path, expected JSON body]
  const cases: Array<[string, () => Promise<unknown>, string, string, unknown]> = [
    ['auth.requestCode', () => api.auth.requestCode('+49123'), 'POST', '/auth/request-code', { phone_number: '+49123' }],
    ['auth.verify', () => api.auth.verify('+49123', '123456'), 'POST', '/auth/verify', { phone_number: '+49123', code: '123456' }],
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
    ['tournaments.listTables', () => api.tournaments.listTables('x'), 'GET', '/tournaments/x/tables', undefined],
    ['tournaments.addTable', () => api.tournaments.addTable('x'), 'POST', '/tournaments/x/tables', { name: null }],
    ['tournaments.addTable (named)', () => api.tournaments.addTable('x', 'Terrasse'), 'POST', '/tournaments/x/tables', { name: 'Terrasse' }],
    ['tournaments.renameTable', () => api.tournaments.renameTable('x', 't1', 'Pool'), 'PATCH', '/tournaments/x/tables/t1', { name: 'Pool' }],
    ['tournaments.deleteTable', () => api.tournaments.deleteTable('x', 't1'), 'DELETE', '/tournaments/x/tables/t1', undefined],
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
