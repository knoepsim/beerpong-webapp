import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRedirectParam, logout, toSafeRedirectPath } from './auth';

describe('logout', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ends the session on the server and goes to the login', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    const location = { href: '/teams', pathname: '/teams', search: '' };
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', location);

    await logout();

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/logout$/);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(location.href).toBe('/login');
  });

  it('goes to the login even if the server cannot be reached', async () => {
    const location = { href: '/teams', pathname: '/teams', search: '' };
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.stubGlobal('location', location);

    await logout();

    expect(location.href).toBe('/login');
  });
});

describe('toSafeRedirectPath', () => {
  it.each([
    ['/tournaments', '/tournaments'],
    ['/teams/join/abc?x=1#top', '/teams/join/abc?x=1#top'],
    [`${window.location.origin}/profile`, '/profile'],
  ])('keeps same-origin target %s', (input, expected) => {
    expect(toSafeRedirectPath(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
  ])('rejects %s', (input) => {
    expect(toSafeRedirectPath(input)).toBeNull();
  });

  it('rejects unparsable targets', () => {
    expect(toSafeRedirectPath('http://[invalid')).toBeNull();
  });
});

describe('getRedirectParam', () => {
  it('returns the validated redirect query parameter', () => {
    window.history.replaceState({}, '', '/login?redirect=%2Fteams%2F1');
    expect(getRedirectParam()).toBe('/teams/1');
  });

  it('returns null for unsafe or missing parameters', () => {
    window.history.replaceState({}, '', '/login?redirect=https%3A%2F%2Fevil.example');
    expect(getRedirectParam()).toBeNull();
    window.history.replaceState({}, '', '/login');
    expect(getRedirectParam()).toBeNull();
  });
});
