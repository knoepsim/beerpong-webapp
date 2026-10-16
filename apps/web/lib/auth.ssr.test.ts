// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getRedirectParam, toSafeRedirectPath } from './auth';

describe('auth helpers without a browser', () => {
  it('are inert on the server', () => {
    expect(getRedirectParam()).toBeNull();
    expect(toSafeRedirectPath('/teams')).toBeNull();
  });
});
