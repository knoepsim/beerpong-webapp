// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { config, proxy } from './proxy';

const call = (path: string, token?: string) =>
  proxy(
    new NextRequest(`http://localhost:3000${path}`, {
      headers: token ? { cookie: `matchbase_access_token=${token}` } : {},
    }),
  );

const location = (res: Response) => res.headers.get('location');

describe('proxy', () => {
  it.each(['/tournaments', '/teams/1', '/profile', '/admin', '/onboarding'])(
    'sends anonymous visitors from %s to the login with a redirect back',
    (path) => {
      const res = call(`${path}?a=1`);
      expect(res.status).toBe(307);
      expect(location(res)).toBe(
        `http://localhost:3000/login?redirect=${encodeURIComponent(`${path}?a=1`)}`,
      );
    },
  );

  it.each(['/t/sommerfest', '/invite/abc2345'])('lets anonymous visitors open %s: the API decides what they see', (path) => {
    expect(location(call(path))).toBeNull();
  });

  it('lets logged-in users reach protected routes', () => {
    expect(location(call('/tournaments', 'tok'))).toBeNull();
  });

  it('lets anonymous visitors reach the login', () => {
    expect(location(call('/login'))).toBeNull();
  });

  it('moves logged-in users from the login to the tournaments', () => {
    expect(location(call('/login', 'tok'))).toBe('http://localhost:3000/tournaments');
  });

  it('routes the root depending on the session', () => {
    expect(location(call('/', 'tok'))).toBe('http://localhost:3000/tournaments');
    expect(location(call('/'))).toBe('http://localhost:3000/login');
  });

  it('lets unrelated paths through', () => {
    expect(location(call('/something-else'))).toBeNull();
  });

  it('declares the matcher for the guarded routes', () => {
    expect(config.matcher).toContain('/login');
  });
});
