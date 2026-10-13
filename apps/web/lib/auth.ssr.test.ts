// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  clearTokens,
  getAccessToken,
  getRedirectParam,
  getRefreshToken,
  setTokens,
  toSafeRedirectPath,
} from './auth';

describe('auth helpers without a browser', () => {
  it('are inert on the server', () => {
    expect(() => setTokens('a', 'b')).not.toThrow();
    expect(() => clearTokens()).not.toThrow();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getRedirectParam()).toBeNull();
    expect(toSafeRedirectPath('/teams')).toBeNull();
  });
});
