/**
 * API client for the JavaScope backend.
 *
 * Maps HTTP / network failures to structured, user-friendly messages so the
 * rest of the UI never has to inspect raw status codes.
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export interface ApiSuccess {
  ok: true;
  // Raw JSON body – validated by the Zod schema in the caller.
  body: unknown;
}

export interface ApiError {
  ok: false;
  /** Human-readable message shown in the UI. */
  message: string;
  /** HTTP status if we received a response, else undefined. */
  status?: number;
}

export type ApiResult = ApiSuccess | ApiError;

/** Maximum time in ms to wait for the backend to respond (20 s = hard-kill timeout + margin). */
const REQUEST_TIMEOUT_MS = 25_000;

/**
 * POST /api/run with the given Java source.
 * Returns either the raw (unvalidated) JSON body or an error message.
 */
export async function runSource(source: string): Promise<ApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const body: unknown = await response.json();
      return { ok: true, body };
    }

    // Map well-known error codes to friendly messages.
    const errorMessage = await friendlyError(response);
    return { ok: false, message: errorMessage, status: response.status };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        ok: false,
        message:
          'Request timed out (the sandbox took too long). Try a shorter or simpler program.',
      };
    }
    // Network failure: no response received.
    return {
      ok: false,
      message:
        'Could not reach the JavaScope server. Check that the API is running and try again.',
    };
  }
}

/** Produce a user-friendly message from a non-2xx response. */
async function friendlyError(response: Response): Promise<string> {
  // Attempt to read the backend's error JSON for more detail.
  let detail = '';
  try {
    const body = (await response.json()) as Record<string, unknown>;
    if (typeof body.message === 'string') {
      detail = ` — ${body.message}`;
    } else if (typeof body.error === 'string') {
      detail = ` — ${body.error}`;
    }
  } catch {
    // Ignore parse errors; fall back to generic messages.
  }

  switch (response.status) {
    case 413:
      return `Source too large (max 20 KB)${detail}`;
    case 429: {
      const retryAfter = response.headers.get('Retry-After');
      const wait = retryAfter ? ` Retry after ${retryAfter} seconds.` : '';
      return `Rate limit exceeded.${wait}${detail}`;
    }
    case 503:
      return `Server busy — too many concurrent runs. Please wait a moment and try again.${detail}`;
    case 400:
      return `Invalid request${detail}`;
    default:
      return `Server error (HTTP ${String(response.status)})${detail}`;
  }
}

/** GET /api/health – used by the fixture loader to confirm the backend is up. */
export async function getHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE_URL}/api/health`, { method: 'GET' });
    return r.ok;
  } catch {
    return false;
  }
}
