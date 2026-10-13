import { beforeEach, describe, expect, it } from 'vitest';
import {
  REFRESH_TOKEN_KEY,
  TOKEN_KEY,
  clearTokens,
  getAccessToken,
  getRedirectParam,
  getRefreshToken,
  setTokens,
  toSafeRedirectPath,
} from './auth';

describe('token storage', () => {
  beforeEach(() => clearTokens());

  it('stores tokens in localStorage and the access token as cookie', () => {
    setTokens('access', 'refresh');

    expect(getAccessToken()).toBe('access');
    expect(getRefreshToken()).toBe('refresh');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('access');
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh');
    expect(document.cookie).toContain(`${TOKEN_KEY}=access`);
  });

  it('removes tokens and cookie on clear', () => {
    setTokens('access', 'refresh');
    clearTokens();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(document.cookie).not.toContain(TOKEN_KEY);
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
