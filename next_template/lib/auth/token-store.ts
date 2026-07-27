/**
 * Where the tokens live.
 *
 * This is a security decision, so here is the reasoning rather than just the
 * code.
 *
 * The three options
 * ----------------
 * **localStorage** — the most common choice and the weakest. Any JavaScript
 * on the page can read it, so a single XSS anywhere (your code, a dependency,
 * an analytics snippet) exfiltrates a long-lived credential. It also persists
 * across tabs and restarts, so the stolen token stays valid.
 *
 * **A JavaScript-readable cookie** (`js-cookie`) — no better. `document.cookie`
 * is as reachable from injected script as `localStorage` is. It reads as more
 * secure because "cookie" and "HttpOnly cookie" get conflated; without the
 * `HttpOnly` flag the protection is not there.
 *
 * **In-memory access token + HttpOnly refresh cookie** — what this module
 * implements. The access token lives in a module variable: unreachable from
 * `document.cookie` or `localStorage`, and gone when the tab closes. The
 * refresh token is set by the server as `HttpOnly; Secure; SameSite=Lax`,
 * so script cannot read it at all and the browser attaches it only to the
 * refresh endpoint.
 *
 * What this does and does not buy you
 * -----------------------------------
 * It does not stop XSS from acting as the user — injected script can just
 * call your API. It does stop the attacker from *taking the credential
 * away*, which is the difference between a session that ends when the tab
 * closes and a token that works from the attacker's machine next week.
 *
 * The cost, honestly
 * ------------------
 * A page refresh loses the in-memory access token, so the app must call
 * `/token/refresh/` on mount to get a new one from the HttpOnly cookie. That
 * is one extra request per cold load and a brief loading state — see
 * `auth-context.tsx`, which handles it.
 *
 * If your backend cannot set an HttpOnly refresh cookie
 * -----------------------------------------------------
 * Set `PERSIST_REFRESH_TOKEN = true` below. The refresh token then goes to
 * `localStorage` and you are back to the weak model — but explicitly, with
 * this comment attached, rather than by default. Prefer fixing the backend:
 * for dj-rest-auth that is `REST_AUTH = {"USE_JWT": True,
 * "JWT_AUTH_HTTPONLY": True, "JWT_AUTH_REFRESH_COOKIE": "refresh_token"}`.
 */

const REFRESH_STORAGE_KEY = 'auth.refresh_token';

/**
 * Set to `true` only if the backend cannot issue an HttpOnly refresh cookie.
 * Read the note above before you do.
 */
export const PERSIST_REFRESH_TOKEN = false;

/**
 * Access token. Module-scoped, never persisted.
 *
 * In Next.js this module is a singleton per browser tab, which is exactly the
 * scope we want. It is also per-server-process during SSR — which is why
 * every accessor below no-ops on the server: writing a user's token into a
 * module variable shared by all concurrent SSR requests would leak it across
 * users. That is not a theoretical concern; it is the standard way this
 * pattern is got wrong.
 */
let accessToken: string | null = null;

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

const isBrowser = () => typeof window !== 'undefined';

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  if (!isBrowser()) return;
  accessToken = token;
  listeners.forEach((listener) => listener(token));
}

/** Subscribe to token changes — used to sync auth state across tabs. */
export function onAccessTokenChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Refresh token, when the fallback mode is enabled.
 *
 * In the default (recommended) mode this returns `null` and the browser sends
 * the HttpOnly cookie for you — which is why the refresh request must be made
 * with `withCredentials: true`.
 */
export function getRefreshToken(): string | null {
  if (!isBrowser() || !PERSIST_REFRESH_TOKEN) return null;
  try {
    return window.localStorage.getItem(REFRESH_STORAGE_KEY);
  } catch {
    // Safari in private mode, or storage disabled by policy. Not fatal.
    return null;
  }
}

export function setRefreshToken(token: string | null): void {
  if (!isBrowser() || !PERSIST_REFRESH_TOKEN) return;
  try {
    if (token) {
      window.localStorage.setItem(REFRESH_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(REFRESH_STORAGE_KEY);
    }
  } catch {
    /* storage unavailable */
  }
}

export function clearTokens(): void {
  setAccessToken(null);
  setRefreshToken(null);
}

/**
 * Whether the access token is expired, read from the JWT payload.
 *
 * A client-side hint only. The token is base64, not encrypted, so anyone can
 * read `exp` — including a caller who edits it. Never let this decide
 * authorization; the server validates the signature. It is here so the UI can
 * refresh proactively instead of waiting for a 401, and so a hard-expired
 * token does not trigger a pointless request.
 *
 * `skewSeconds` treats a token as expired slightly early, so a request does
 * not leave with a token that expires while it is in flight.
 */
export function isTokenExpired(token: string | null, skewSeconds = 10): boolean {
  if (!token) return true;
  try {
    const [, payload] = token.split('.');
    if (!payload) return true;
    // Base64url -> base64 before decoding: JWT uses the URL-safe alphabet and
    // strips padding, which atob() does not accept.
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    const { exp } = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof exp !== 'number') return false;
    return exp - skewSeconds <= Date.now() / 1000;
  } catch {
    // Unparseable: treat as expired so the refresh path runs rather than
    // sending a token the server will reject anyway.
    return true;
  }
}
