import { describe, it, expect } from 'vitest';
import { toSafeRedirectPath } from './auth';

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
});
