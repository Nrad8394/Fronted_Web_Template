/**
 * Every backend path in one place.
 *
 * Paths are RELATIVE. That is the important design choice here, and it is a
 * correction of a pattern that looked reasonable and caused real bugs.
 *
 * The tempting version builds absolute URLs:
 *
 *     export const Endpoints = {
 *       Login: `${getApiUrl()}/auth/login/`,     // don't
 *     };
 *
 * That evaluates `getApiUrl()` when the module is first imported — which, in
 * a Docker deployment, can be before `env-config.js` has populated
 * `window.__ENV__`. The host is frozen to the build-time fallback, forever,
 * for every endpoint defined this way. The failure is silent: the app works
 * in development and points at `localhost:8000` in production.
 *
 * A real project hit exactly this and worked around it inside the HTTP
 * client, with an interceptor that parsed every outgoing absolute URL and
 * stripped the origin back off if the path looked like one of its own:
 *
 *     if (config.url && /^https?:\/\//i.test(config.url)) {
 *       const parsed = new URL(config.url);
 *       if (parsed.pathname.startsWith('/api/')) {
 *         config.url = parsed.pathname + parsed.search;   // undo the join
 *       }
 *     }
 *
 * Building a URL and then taking it apart again on every request is the
 * symptom. Keeping paths relative and letting axios's `baseURL` — which the
 * client re-reads per request — supply the host removes the cause. Axios
 * ignores `baseURL` whenever the URL is absolute, so relative paths are also
 * what makes `baseURL` work at all.
 *
 * Corollary: if you need an absolute URL (an `<a href>`, a redirect target),
 * call `absoluteUrl()` at the point of use, not at module scope.
 */

import { getApiUrl } from '@/lib/env';

/** Resolve a relative endpoint against the runtime API host. Call at use time. */
export function absoluteUrl(path: string): string {
  const base = getApiUrl();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

const V1 = '/api/v1';

export const Endpoints = {
  Auth: {
    Login: `${V1}/auth/login/`,
    Logout: `${V1}/auth/logout/`,
    Register: `${V1}/auth/registration/`,
    // Not called through the authenticated client — see `client.ts`.
    TokenRefresh: `${V1}/auth/token/refresh/`,
    TokenVerify: `${V1}/auth/token/verify/`,
    User: `${V1}/auth/user/`,
    PasswordChange: `${V1}/auth/password/change/`,
    PasswordReset: `${V1}/auth/password/reset/`,
    PasswordResetConfirm: `${V1}/auth/password/reset/confirm/`,
    VerifyEmail: `${V1}/auth/registration/verify-email/`,
    ResendVerification: `${V1}/auth/registration/resend-email/`,
    SocialGoogle: `${V1}/auth/google/`,
  },

  Core: {
    Health: '/health/',
    Ready: '/readyz/',
    Version: `${V1}/core/version/`,
    CsrfToken: `${V1}/core/csrf-token/`,
    TaskStatus: (taskId: string) => `${V1}/core/tasks/${taskId}/status/`,
  },

  /**
   * Domain resources.
   *
   * Replace this block. It is here to show the shape: one entry per resource
   * with `List` doubling as the create URL (DRF routers use the same path for
   * `GET` and `POST`), and functions for anything parameterised.
   *
   * `List` is also the react-query cache key in `lib/api/hooks.ts`, so a
   * mutation on `Detail(id)` invalidates the matching `List` automatically.
   */
  Example: {
    List: `${V1}/example/items/`,
    Detail: (id: string | number) => `${V1}/example/items/${id}/`,
    // Provided by BaseModelViewSet on the Django side.
    BulkCreate: `${V1}/example/items/bulk_create/`,
    BulkUpdate: `${V1}/example/items/bulk_update/`,
    BulkDelete: `${V1}/example/items/bulk_delete/`,
    BulkRestore: `${V1}/example/items/bulk_restore/`,
    BulkExport: `${V1}/example/items/bulk_export/`,
    BulkImport: `${V1}/example/items/bulk_import/`,
    ImportTemplate: `${V1}/example/items/bulk_import_template/`,
    Statistics: `${V1}/example/items/statistics/`,
    Restore: (id: string | number) => `${V1}/example/items/${id}/restore/`,
    HardDelete: (id: string | number) => `${V1}/example/items/${id}/hard_delete/`,
  },
} as const;

export default Endpoints;
