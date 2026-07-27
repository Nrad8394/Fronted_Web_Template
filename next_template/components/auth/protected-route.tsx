'use client';

/**
 * Client-side route guards.
 *
 * Read this before relying on them: **a client-side guard is not security.**
 * It hides UI. Anyone can disable JavaScript, edit the bundle, or call the
 * API directly. The only thing standing between a user and your data is the
 * backend's permission check on every endpoint. These components exist so
 * that a signed-out visitor sees a login page instead of an empty dashboard
 * full of failed requests — a UX affordance, nothing more.
 *
 * For genuine protection of server-rendered content, check the session in a
 * Server Component or `middleware.ts`, where the decision is made before any
 * markup is sent.
 */

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth/auth-context';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Where to send unauthenticated visitors. */
  redirectTo?: string;
  /** Permission codename required in addition to being signed in. */
  permission?: string;
  /** Rendered while the session is being restored. */
  fallback?: ReactNode;
}

function DefaultFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
    </div>
  );
}

export function ProtectedRoute({
  children,
  redirectTo = '/login',
  permission,
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Carry the current path so login can return the user where they were.
      // Encoding matters: a path with a query string breaks the redirect
      // parameter otherwise.
      //
      // On the receiving end, only ever redirect to a path starting with a
      // single `/`. Accepting an absolute URL from this parameter is an open
      // redirect — a phishing primitive that looks like your own login link.
      router.replace(`${redirectTo}?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isLoading, pathname, redirectTo, router]);

  // `router.replace` is asynchronous, so this component renders at least once
  // more after the effect runs. Returning the fallback rather than `children`
  // is what stops a flash of protected content on the way out.
  if (isLoading || !isAuthenticated) {
    return <>{fallback ?? <DefaultFallback />}</>;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="text-sm opacity-70">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * The inverse: keep signed-in users off the login and registration pages.
 *
 * Without it, a signed-in user who navigates back to `/login` sees the form,
 * signs in again, and gets a fresh token pair for no reason.
 */
export function GuestRoute({
  children,
  redirectTo = '/dashboard',
  fallback,
}: {
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, redirectTo, router]);

  if (isLoading || isAuthenticated) {
    return <>{fallback ?? <DefaultFallback />}</>;
  }

  return <>{children}</>;
}
