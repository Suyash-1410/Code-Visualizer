/**
 * Tests for API client: error mapping logic (all branches).
 * Uses Vitest's vi.stubGlobal to mock fetch without any external library.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runSource } from '../../api/client';

// ---------------------------------------------------------------------------
// Helpers to build mock Response objects
// ---------------------------------------------------------------------------

function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const bodyStr = JSON.stringify(body);
  return new Response(bodyStr, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function makeNetworkError(): Promise<never> {
  return Promise.reject(new TypeError('Failed to fetch'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('API client — error mapping', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns success with body on 200', async () => {
    const mockBody = { schemaVersion: 1, status: 'ok', steps: [] };
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse(200, mockBody));

    const result = await runSource('public class Main {}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toEqual(mockBody);
    }
  });

  it('maps 413 to a friendly source-too-large message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeResponse(413, { message: 'Source exceeds 20480 bytes' }),
    );

    const result = await runSource('x'.repeat(21000));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
      expect(result.message).toMatch(/20 KB/i);
    }
  });

  it('maps 429 to rate-limit message with Retry-After', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeResponse(429, { message: 'Rate limit exceeded' }, { 'Retry-After': '42' }),
    );

    const result = await runSource('public class Main {}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.message).toMatch(/rate limit/i);
      expect(result.message).toMatch(/42/);
    }
  });

  it('maps 503 to server-busy message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeResponse(503, { message: 'Queue full' }),
    );

    const result = await runSource('public class Main {}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.message).toMatch(/server busy/i);
    }
  });

  it('maps 400 to invalid request message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeResponse(400, { message: 'source must be a string' }),
    );

    const result = await runSource('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.message).toMatch(/invalid request/i);
    }
  });

  it('maps network failure to a cannot-reach message', async () => {
    vi.mocked(fetch).mockImplementationOnce(makeNetworkError);

    const result = await runSource('public class Main {}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/could not reach/i);
      expect(result.status).toBeUndefined();
    }
  });

  it('maps AbortError (timeout) to a timeout message', async () => {
    // Simulate fetch being aborted after a very short delay
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          const err = new DOMException('The operation was aborted.', 'AbortError');
          // Reject synchronously so we don't wait for the real 25 s timer
          reject(err);
        }),
    );

    const result = await runSource('public class Main {}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/timed out/i);
    }
  });

  it('falls back gracefully for unknown status codes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse(502, {}));

    const result = await runSource('public class Main {}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
      expect(result.message).toMatch(/502/);
    }
  });
});
