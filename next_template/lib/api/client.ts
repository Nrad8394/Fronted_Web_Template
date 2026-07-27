'use client';

/**
 * The HTTP client.
 *
 * Two axios instances, and the split matters:
 *
 * `api`      authenticated. Attaches the access token, refreshes it on 401,
 *            retries the original request.
 * `plainApi` no interceptors. Used for login, registration, and the refresh
 *            call itself.
 *
 * Why the second instance exists: if the refresh request went through `api`,
 * a 401 from the refresh endpoint would trigger the refresh interceptor,
 * which would call refresh again, which would 401… An infinite loop, and the
 * usual workaround is a string check for `/token/refresh` inside the
 * interceptor — fragile, since it breaks silently when the route is renamed.
 * A separate instance makes it structural.
 *
 * Bugs from the previous version of this file, each fixed below
 * ------------------------------------------------------------
 * 1. `await localStorage.getItem(...)` — localStorage is synchronous. The
 *    `await` is harmless but reveals the code was pasted from React Native's
 *    async `AsyncStorage`.
 *
 * 2. `config.headers = {}` in the no-token branch — this **replaced** the
 *    entire header object, destroying `Content-Type` on every unauthenticated
 *    request. POSTs then went out without a content type and the server
 *    rejected them. Never assign to `config.headers`; set individual keys.
 *
 * 3. No refresh mutex. Ten concurrent requests hitting an expired token fired
 *    ten refresh calls. With refresh-token rotation enabled — the correct
 *    server setting — the first rotates the token and the other nine present
 *    one that has just been blacklisted, so nine fail and the user is logged
 *    out at random. `refreshPromise` below collapses them into one.
 *
 * 4. The refresh call used the same instance as everything else. See above.
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { getApiUrl } from '@/lib/env';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/lib/auth/token-store';

import { Endpoints } from './endpoints';
import { normalizeError } from './errors';

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * `withCredentials` is required for the HttpOnly refresh cookie to be sent.
 * It also means the API must echo an explicit `Access-Control-Allow-Origin`
 * (never `*`) and set `Access-Control-Allow-Credentials: true` — the Django
 * template's `CORS_ALLOW_CREDENTIALS=True` with an explicit origin list.
 */
const shared: AxiosRequestConfig = {
  timeout: REQUEST_TIMEOUT_MS,
  withCredentials: true,
  headers: {
    // Lets the server distinguish an XHR from a top-level navigation, so it
    // can return 401 JSON instead of redirecting to a login page.
    'X-Requested-With': 'XMLHttpRequest',
  },
};

export const api: AxiosInstance = axios.create({ ...shared, baseURL: getApiUrl() });

/** No interceptors. For login, registration, and token refresh. */
export const plainApi: AxiosInstance = axios.create({ ...shared, baseURL: getApiUrl() });

// ---------------------------------------------------------------------------
// Request: resolve the host, attach the token
// ---------------------------------------------------------------------------

function attachBaseUrl(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  // Re-read the host per request. `axios.create()` above runs at module load,
  // which can precede `env-config.js` populating `window.__ENV__` — so the
  // value captured there may be the build-time fallback. This is the second
  // half of the fix described in `endpoints.ts`; together they mean no code
  // path can freeze a stale API host.
  config.baseURL = getApiUrl();
  return config;
}

api.interceptors.request.use((config) => {
  attachBaseUrl(config);

  const token = getAccessToken();
  if (token) {
    // Set the key. Do NOT assign to config.headers — see note 2 above.
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

plainApi.interceptors.request.use(attachBaseUrl);

// ---------------------------------------------------------------------------
// Response: refresh once, retry once
// ---------------------------------------------------------------------------

/**
 * In-flight refresh, shared by every request that hits a 401 while it runs.
 *
 * This single variable is what stops the thundering-herd logout described in
 * note 3. Concurrent callers await the same promise; exactly one network call
 * is made.
 */
let refreshPromise: Promise<string> | null = null;

/** Set by the auth context so a failed refresh can tear down app state. */
let onAuthFailure: (() => void) | null = null;

export function setAuthFailureHandler(handler: (() => void) | null): void {
  onAuthFailure = handler;
}

/**
 * Suppresses error reporting during a deliberate logout.
 *
 * Signing out cancels in-flight requests and unmounts the pages that made
 * them. Those failures are expected, and showing "Session expired" as the
 * user clicks Sign Out is noise that looks like a bug.
 */
let isLoggingOut = false;

export function setLoggingOut(value: boolean): void {
  isLoggingOut = value;
}

export function getIsLoggingOut(): boolean {
  return isLoggingOut;
}

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    // In the default configuration this is null and the browser sends the
    // HttpOnly cookie instead — which is why `withCredentials` is essential.
    const stored = getRefreshToken();

    const { data } = await plainApi.post<{ access: string; refresh?: string }>(
      Endpoints.Auth.TokenRefresh,
      stored ? { refresh: stored } : {},
    );

    if (!data?.access) throw new Error('Refresh response contained no access token');

    setAccessToken(data.access);
    // Present only when the server rotates refresh tokens. Store it or the
    // next refresh presents a blacklisted one.
    if (data.refresh) setRefreshToken(data.refresh);

    return data.access;
  })();

  try {
    return await refreshPromise;
  } finally {
    // Always clear, success or failure. Leaving a rejected promise here means
    // every subsequent 401 re-throws the first failure without retrying.
    refreshPromise = null;
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;

    if (isLoggingOut || !config || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // One retry per request. Without this flag a server that returns 401 even
    // for a valid token loops forever.
    if (config._retried) {
      return Promise.reject(error);
    }
    config._retried = true;

    try {
      const token = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return api.request(config);
    } catch (refreshError) {
      // The refresh token is gone or rejected: the session is genuinely over.
      clearTokens();
      onAuthFailure?.();
      return Promise.reject(refreshError);
    }
  },
);

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------

/**
 * Thin wrappers returning `data` rather than the axios response.
 *
 * Errors propagate as-is; pass them to `normalizeError()` where you handle
 * them. The client deliberately does not show toasts itself — a client that
 * both throws and displays produces duplicate messages the moment a caller
 * adds its own handling, and makes error UI impossible to customise per call
 * site.
 */
export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    api.get<T>(url, config).then((r) => r.data),

  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.post<T>(url, data, config).then((r) => r.data),

  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.put<T>(url, data, config).then((r) => r.data),

  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.patch<T>(url, data, config).then((r) => r.data),

  delete: <T = void>(url: string, config?: AxiosRequestConfig) =>
    api.delete<T>(url, config).then((r) => r.data),
};

/**
 * Download a file the API generates (an export, a PDF).
 *
 * Uses `responseType: 'blob'` and an object URL rather than pointing
 * `window.location` at the endpoint, because a plain navigation carries no
 * `Authorization` header and the request arrives unauthenticated.
 *
 * The `revokeObjectURL` is not optional: without it the blob is pinned in
 * memory for the lifetime of the document, so a page where a user exports
 * repeatedly leaks the full size of every file they downloaded.
 */
export async function downloadFile(
  url: string,
  filename: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  const response = await api.get(url, { ...config, responseType: 'blob' });

  // Prefer the server's filename when it sent one.
  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const resolved = match ? decodeURIComponent(match[1]) : filename;

  const objectUrl = URL.createObjectURL(response.data as Blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = resolved;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Poll an endpoint until a condition holds. For long-running Celery tasks.
 *
 * Backs off geometrically rather than polling at a fixed interval: a task
 * that takes ten minutes should not generate 600 requests. The cap keeps the
 * final interval reasonable.
 */
export async function pollUntil<T>(
  url: string,
  isDone: (data: T) => boolean,
  options: {
    intervalMs?: number;
    maxIntervalMs?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const {
    intervalMs = 1_000,
    maxIntervalMs = 10_000,
    timeoutMs = 300_000,
    signal,
  } = options;

  const deadline = Date.now() + timeoutMs;
  let wait = intervalMs;

  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const data = await http.get<T>(url, { signal });
    if (isDone(data)) return data;

    if (Date.now() + wait > deadline) {
      throw new Error(`Timed out after ${timeoutMs}ms polling ${url}`);
    }

    await new Promise((resolve) => setTimeout(resolve, wait));
    wait = Math.min(wait * 1.5, maxIntervalMs);
  }
}

export { normalizeError };
