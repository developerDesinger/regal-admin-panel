import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/**
 * HTTP client for the admin API.
 *
 * Base URL comes from VITE_API_BASE_URL. In development that is a same-origin
 * path (`/api/v1/admin`) which vite proxies to VITE_API_TUNNEL — see
 * vite.config.ts for why the proxy exists rather than calling the tunnel
 * directly. In production it is the API's absolute origin.
 *
 * Auth model (§01 Non-negotiables / §21 Security):
 *  · The session lives in an httpOnly, Secure, SameSite=Strict cookie set by
 *    the server. There is deliberately no bearer token read from localStorage —
 *    a token reachable from JS is a token an XSS can exfiltrate.
 *  · `withCredentials` sends that cookie on every call.
 *  · Mutations carry a CSRF token, which the server issues in a readable
 *    (non-httpOnly) companion cookie.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1/admin';

/** `mock` renders fixtures; `api` calls the backend. See .env.development. */
export const DATA_SOURCE = (import.meta.env.VITE_DATA_SOURCE as 'mock' | 'api') ?? 'mock';
export const usingMockData = DATA_SOURCE !== 'api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  // A hung request must not leave a table spinning forever; §21 targets 500ms
  // for interactions, so 20s is already a pathological case.
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = readCookie('csrf_token');
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

/** Error codes the backend contract defines (docs/BACKEND_API_REQUIREMENTS.md §1). */
export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'INSUFFICIENT_PERMISSION'
  | 'CSRF_INVALID'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'NETWORK'
  | 'TIMEOUT';

/**
 * Normalized error every caller can rely on. Screens render `message`
 * directly, so it must always be human-readable — never an empty string or a
 * raw stack.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  readonly details: Record<string, unknown> | null;
  readonly retryAfterSeconds: number | null;

  constructor(init: {
    code: ApiErrorCode;
    message: string;
    status?: number | null;
    details?: Record<string, unknown> | null;
    retryAfterSeconds?: number | null;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status ?? null;
    this.details = init.details ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }
}

const STATUS_FALLBACK: Record<number, { code: ApiErrorCode; message: string }> = {
  400: { code: 'VALIDATION_FAILED', message: 'The request was rejected as invalid.' },
  401: { code: 'UNAUTHENTICATED', message: 'Your session has expired. Sign in again.' },
  403: { code: 'INSUFFICIENT_PERMISSION', message: 'Your role cannot perform this action.' },
  404: { code: 'NOT_FOUND', message: 'That record no longer exists.' },
  409: { code: 'CONFLICT', message: 'That change conflicts with the current state.' },
  422: { code: 'VALIDATION_FAILED', message: 'Some fields need correcting.' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' },
};

function normalize(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  const ax = error as AxiosError<{ error?: { code?: string; message?: string; details?: Record<string, unknown> } }>;

  if (ax.code === 'ECONNABORTED') {
    return new ApiError({ code: 'TIMEOUT', message: 'The server took too long to respond.' });
  }

  // No response at all: backend down, tunnel closed, DNS, or offline.
  if (!ax.response) {
    return new ApiError({
      code: 'NETWORK',
      message: navigator.onLine
        ? 'Could not reach the admin API. It may be offline.'
        : 'You appear to be offline.',
    });
  }

  const { status, data, headers } = ax.response;
  const body = data?.error;
  const fallback = STATUS_FALLBACK[status] ?? {
    code: 'INTERNAL' as ApiErrorCode,
    message: 'Something went wrong on the server.',
  };
  const retryAfter = Number(headers?.['retry-after']);

  return new ApiError({
    code: (body?.code as ApiErrorCode) ?? fallback.code,
    // A blank server message is worse than our generic one.
    message: body?.message?.trim() || fallback.message,
    status,
    details: body?.details ?? null,
    retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
  });
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalized = normalize(error);
    // 401 → the session cookie expired or was revoked. The server clears it;
    // the client only has to send the admin back to the login screen.
    if (
      normalized.code === 'UNAUTHENTICATED' &&
      !window.location.pathname.startsWith('/login')
    ) {
      window.location.href = '/login?reason=session';
    }
    return Promise.reject(normalized);
  },
);

/** Unwraps the `{ data, meta }` envelope the contract specifies. */
export interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export async function request<T>(config: AxiosRequestConfig): Promise<Envelope<T>> {
  const res = await api.request<Envelope<T>>(config);
  return res.data;
}

export const get = <T>(url: string, params?: Record<string, unknown>) =>
  request<T>({ method: 'get', url, params });

export const post = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  request<T>({ method: 'post', url, data, ...config });

export const patch = <T>(url: string, data?: unknown) =>
  request<T>({ method: 'patch', url, data });

export const put = <T>(url: string, data?: unknown) => request<T>({ method: 'put', url, data });

export const del = <T>(url: string, data?: unknown) =>
  request<T>({ method: 'delete', url, data });

/**
 * Cheap connectivity probe. Returns the failure instead of throwing so callers
 * can render "API unreachable" without a try/catch at every call site.
 */
export async function checkApiHealth(): Promise<
  { ok: true } | { ok: false; error: ApiError }
> {
  try {
    await api.get('/auth/me', { timeout: 8_000 });
    return { ok: true };
  } catch (e) {
    const err = normalize(e);
    // A 401 still proves the API answered — it is reachable, just not signed in.
    if (err.code === 'UNAUTHENTICATED') return { ok: true };
    return { ok: false, error: err };
  }
}

export default api;
