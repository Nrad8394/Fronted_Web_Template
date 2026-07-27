/**
 * Runtime-resolved public configuration.
 *
 * The problem
 * -----------
 * Next.js replaces every `process.env.NEXT_PUBLIC_*` reference with a string
 * literal at build time. In a Docker workflow that means the API URL is baked
 * into the image, so `staging` and `production` need separate images built
 * from identical source. That defeats the point of promoting a tested
 * artefact between environments, and it means a URL change requires a
 * rebuild rather than a restart.
 *
 * The fix
 * -------
 * `docker-entrypoint.sh` writes `/public/env-config.js` at container start,
 * setting `window.__ENV__`. `app/layout.tsx` loads it with
 * `strategy="beforeInteractive"` so it runs before any React code. This
 * module reads `window.__ENV__` first and falls back to `process.env` for SSR
 * and for `next dev`, where no container is involved.
 *
 * Why these are functions, not consts
 * -----------------------------------
 * A module-level `const` captures its value the first time the module is
 * evaluated, which can happen before `env-config.js` has run — freezing the
 * build-time fallback forever. The symptom is an app that works in
 * development and silently talks to `localhost:8000` in production. Reading
 * lazily at call time is what makes runtime injection actually work.
 *
 * To add a variable:
 *   1. `docker-entrypoint.sh`
 *   2. the `Window.__ENV__` interface below
 *   3. an accessor here
 *   4. `.env.example`
 */

declare global {
  interface Window {
    __ENV__?: {
      NEXT_PUBLIC_API_URL?: string;
      NEXT_PUBLIC_APP_NAME?: string;
      NEXT_PUBLIC_APP_ENV?: string;
    };
  }
}

type RuntimeEnvKey = keyof NonNullable<Window['__ENV__']>;

function readRuntime(key: RuntimeEnvKey): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const value = window.__ENV__?.[key];
  // The entrypoint writes "" for unset variables (shell `${VAR:-}`), so an
  // empty string means "not provided" and must fall through to process.env
  // rather than being treated as a deliberate empty value.
  return value ? value : undefined;
}

/**
 * Clean up an API base URL before anything builds requests from it.
 *
 * Two specific failures this prevents, both seen in production:
 *
 * - A trailing dot on the hostname. `api.example.com.` is a fully-qualified
 *   name that resolves identically but is a *different origin* to the
 *   browser. Same-origin requests silently become cross-origin and fail as
 *   an inscrutable CORS error on a URL that looks correct.
 * - A trailing slash. Endpoints are joined as `${base}${path}` where paths
 *   start with `/`, so `http://host/` yields `http://host//api/...`. Some
 *   servers normalise that, Django does not.
 */
function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    url.hostname = url.hostname.replace(/\.+$/, '');
    return url.toString().replace(/\/+$/, '');
  } catch {
    // Not absolute — a same-origin path like "/api" is valid and common when
    // a reverse proxy fronts both the app and the API.
    return trimmed.replace(/\.+$/, '');
  }
}

/**
 * Base URL for API requests.
 *
 * Defaults to `/api`, a same-origin relative path, on the assumption that
 * production puts a reverse proxy in front of both. Same-origin avoids CORS
 * preflights and third-party-cookie restrictions entirely. Set
 * `NEXT_PUBLIC_API_URL` to an absolute URL when the API is on another host.
 */
export function getApiUrl(): string {
  return normalizeApiUrl(
    readRuntime('NEXT_PUBLIC_API_URL') ?? process.env.NEXT_PUBLIC_API_URL ?? '/api',
  );
}

export function getAppName(): string {
  return readRuntime('NEXT_PUBLIC_APP_NAME') ?? process.env.NEXT_PUBLIC_APP_NAME ?? 'App';
}

/** `development` | `staging` | `production` — for feature flags and telemetry. */
export function getAppEnv(): string {
  return readRuntime('NEXT_PUBLIC_APP_ENV') ?? process.env.NEXT_PUBLIC_APP_ENV ?? 'development';
}

export function isProduction(): boolean {
  return getAppEnv() === 'production';
}

/**
 * Server-only secrets.
 *
 * Anything without the `NEXT_PUBLIC_` prefix stays on the server, so it must
 * never be read from a Client Component. There is no runtime guard that can
 * catch this for you — the value is simply `undefined` in the browser, which
 * fails in a confusing way rather than an obvious one. Read these only in
 * Server Components, Route Handlers, and `lib/server-api.ts`.
 */
export const serverEnv = {
  /** Internal API host for server-side fetches — often a container name
   *  unreachable from the browser (`http://api:8000`). */
  apiUrl: () => process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '',
};

export {};
