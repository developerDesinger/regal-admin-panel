import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n';
import { DISPLAY_TZ } from '@/lib/format';

/**
 * HTTP client for the admin API.
 *
 * Contract: docs/BACKEND_API_REQUIREMENTS.md and the backend's ADMIN_PANEL_API
 * reference. Base URL is `{VITE_API_BASE_URL}/api/v1/admin` — in development
 * VITE_API_BASE_URL is empty so the path stays same-origin and vite proxies it
 * onto the tunnel (see vite.config.ts for why the proxy exists: the session
 * cookie is SameSite=Strict and would never survive a cross-site call).
 *
 * Session model:
 *  · The session is an httpOnly cookie. There is no token in the response body
 *    and nothing for us to store — `withCredentials` carries it.
 *  · Mutations need `X-CSRF-Token`. That token IS in the response body, from
 *    login / 2FA verify / `/auth/me` / change-password. It is held in memory
 *    only: writing it to localStorage would hand it to any XSS.
 */

export const API_ORIGIN = import.meta.env.VITE_API_BASE_URL ?? '';
export const API_BASE_URL = `${API_ORIGIN}/api/v1/admin`;

/* ------------------------------------------------------------------ csrf -- */

let csrfToken = '';

export function setCsrfToken(token: string | null | undefined) {
  csrfToken = token ?? '';
}

export function getCsrfToken() {
  return csrfToken;
}

/* ---------------------------------------------------------------- errors -- */

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DISABLED'
  | 'INSUFFICIENT_PERMISSION'
  | 'CSRF_INVALID'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'GONE'
  | 'INTERNAL'
  | 'NETWORK'
  | 'TIMEOUT';

/**
 * Normalized error. `message` is always human-readable — the server writes it
 * for display, and we substitute a usable sentence when it doesn't.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  /** On a 422 this is keyed by field name, ready to map onto form errors. */
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

  /** 422 field errors, for react-hook-form `setError`. */
  get fieldErrors(): Record<string, string> {
    if (this.code !== 'VALIDATION_FAILED' || !this.details) return {};
    return Object.fromEntries(
      Object.entries(this.details)
        .filter(([, v]) => typeof v === 'string')
        .map(([k, v]) => [k, v as string]),
    );
  }
}

/**
 * Fallback sentence per status, used only when the server sends no message of
 * its own. Keyed by translation id and resolved at throw time, so the wording
 * follows the admin's chosen language.
 */
const STATUS_FALLBACK: Record<number, { code: ApiErrorCode; messageKey: string }> = {
  400: { code: 'VALIDATION_FAILED', messageKey: 'apiError.validationFailed' },
  401: { code: 'UNAUTHENTICATED', messageKey: 'apiError.unauthenticated' },
  403: { code: 'INSUFFICIENT_PERMISSION', messageKey: 'apiError.insufficientPermission' },
  404: { code: 'NOT_FOUND', messageKey: 'apiError.notFound' },
  409: { code: 'CONFLICT', messageKey: 'apiError.conflict' },
  410: { code: 'GONE', messageKey: 'apiError.gone' },
  422: { code: 'VALIDATION_FAILED', messageKey: 'apiError.fieldsNeedCorrecting' },
  429: { code: 'RATE_LIMITED', messageKey: 'apiError.rateLimited' },
};

interface ServerErrorBody {
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  const ax = error as AxiosError<ServerErrorBody>;

  if (ax.code === 'ECONNABORTED') {
    return new ApiError({ code: 'TIMEOUT', message: i18n.t('apiError.timeout') });
  }

  // No response at all: backend down, tunnel closed, DNS, or offline.
  if (!ax.response) {
    return new ApiError({
      code: 'NETWORK',
      message: navigator.onLine ? i18n.t('apiError.unreachable') : i18n.t('apiError.offline'),
    });
  }

  const { status, data, headers } = ax.response;
  const body = data?.error;
  const fallback = STATUS_FALLBACK[status] ?? {
    code: 'INTERNAL' as ApiErrorCode,
    messageKey: 'apiError.internal',
  };
  // 429 carries real remaining seconds in both the header and details.
  const headerRetry = Number((headers as Record<string, string> | undefined)?.['retry-after']);
  const detailRetry = Number(body?.details?.retryAfter);
  const retryAfter = Number.isFinite(headerRetry)
    ? headerRetry
    : Number.isFinite(detailRetry)
      ? detailRetry
      : null;

  return new ApiError({
    code: (body?.code as ApiErrorCode) ?? fallback.code,
    // A blank server message is worse than our generic one.
    message: body?.message?.trim() || i18n.t(fallback.messageKey),
    status,
    details: body?.details ?? null,
    retryAfterSeconds: retryAfter,
  });
}

/* ---------------------------------------------------------------- client -- */

export const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // without this every call 401s after a "successful" login
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

http.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toUpperCase();
  if (!READ_METHODS.includes(method) && csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  // Ranged queries are civil dates in a zone; without tz, month-end reports
  // quietly lose their last hours.
  if (config.params && typeof config.params === 'object') {
    const p = config.params as Record<string, unknown>;
    if (('range' in p || 'from' in p) && !p.tz) p.tz = DISPLAY_TZ;
  }
  return config;
});

/** Set by the auth layer so a CSRF failure can re-mint the token and retry. */
let refreshCsrf: (() => Promise<void>) | null = null;
export function registerCsrfRefresher(fn: (() => Promise<void>) | null) {
  refreshCsrf = fn;
}

type RetriableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean };

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ServerErrorBody>) => {
    const normalized = normalizeError(error);
    const config = error.config as RetriableConfig | undefined;

    // The token is bound to the session; if it drifted, re-read /auth/me once.
    if (normalized.code === 'CSRF_INVALID' && config && !config._csrfRetried && refreshCsrf) {
      config._csrfRetried = true;
      try {
        await refreshCsrf();
        if (csrfToken) config.headers.set('X-CSRF-Token', csrfToken);
        return await http.request(config);
      } catch {
        /* fall through to reject with the original error */
      }
    }

    // 401 → the cookie expired or was revoked. The server clears it; we only
    // have to send the admin back to the login screen. INVALID_CREDENTIALS is
    // also a 401 but belongs inline on the form, so it must not redirect.
    if (
      normalized.code === 'UNAUTHENTICATED' &&
      !window.location.pathname.startsWith('/login')
    ) {
      setCsrfToken(null);
      window.location.href = '/login?reason=session';
    }

    return Promise.reject(normalized);
  },
);

/* -------------------------------------------------------------- helpers -- */

/** The `{ data, meta }` envelope every endpoint returns. */
export interface Envelope<T, M = Record<string, unknown>> {
  data: T;
  meta?: M;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  dataAsOf?: string;
}

export async function request<T, M = Record<string, unknown>>(
  config: AxiosRequestConfig,
): Promise<Envelope<T, M>> {
  const res = await http.request<Envelope<T, M>>(config);
  // 204s have no body; callers of void endpoints ignore the value.
  return res.data ?? ({ data: undefined as T });
}

export const apiGet = <T, M = Record<string, unknown>>(
  url: string,
  params?: Record<string, unknown>,
) => request<T, M>({ method: 'get', url, params });

export const apiPost = <T, M = Record<string, unknown>>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
) => request<T, M>({ method: 'post', url, data, ...config });

export const apiPatch = <T>(url: string, data?: unknown) =>
  request<T>({ method: 'patch', url, data });

export const apiPut = <T>(url: string, data?: unknown) =>
  request<T>({ method: 'put', url, data });

export const apiDelete = <T>(url: string, data?: unknown) =>
  request<T>({ method: 'delete', url, data });

/** Strips empty/`all` values so we don't send noise the server has to ignore. */
export function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params)
      // `false` would serialize as the string "false", which the server reads
      // as truthy — drop it along with the other empty values.
      .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all' && v !== false)
      .map(([k, v]) => [k, v === true ? 1 : v]),
  );
}

/**
 * Connectivity probe. Returns the failure rather than throwing so callers can
 * render "API unreachable" without a try/catch at every call site. A 401 still
 * proves the API answered.
 */
export async function checkApiHealth(): Promise<{ ok: true } | { ok: false; error: ApiError }> {
  try {
    await http.get('/auth/me', { timeout: 8_000 });
    return { ok: true };
  } catch (e) {
    const err = normalizeError(e);
    if (err.code === 'UNAUTHENTICATED') return { ok: true };
    return { ok: false, error: err };
  }
}

export default http;
