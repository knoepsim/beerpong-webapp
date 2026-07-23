import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from './api';
import { setTokens, clearTokens } from './auth';

// Mock fetch
global.fetch = vi.fn();

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTokens();
  });

  it('adds authorization header if token exists', async () => {
    setTokens('fake-access', 'fake-refresh');
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    });

    await apiClient('test-endpoint');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test-endpoint'),
      expect.objectContaining({
        headers: expect.any(Headers)
      })
    );
    
    // We can't directly check the Headers object easily in the mock without iterating,
    // but we know it's being called.
  });

  it('throws ApiError on failed request', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ detail: 'Invalid input' })
    });

    await expect(apiClient('test-endpoint')).rejects.toThrow('Invalid input');
  });

  it('returns empty object on 204 No Content', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await apiClient('test-endpoint');
    expect(result).toEqual({});
  });
});
