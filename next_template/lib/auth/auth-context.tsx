'use client';

/**
 * Authentication state for the app.
 *
 * Differences from the version this replaces, all of which were real problems:
 *
 * **`'use client'`.** The old provider used `useState` with no directive. In
 * the App Router that is a build error at best and a confusing runtime
 * failure at worst.
 *
 * **Errors propagate.** The old `login()` caught everything, set
 * `error: 'Login failed, please try again.'` on the context, and returned
 * `undefined`. The calling form could not tell success from failure, could
 * not distinguish "wrong password" from "account locked", and could not
 * attach a validation message to the password field. Here `login()` resolves
 * with the user or rejects — the form awaits it and uses `normalizeError` to
 * decide what to show.
 *
 * **A three-state `status`.** `loading | authenticated | unauthenticated`
 * rather than a boolean. With a boolean, "not logged in" and "we have not
 * checked yet" are indistinguishable, so every guard flashes the login page
 * for a moment on each reload before the check completes. The extra state is
 * what removes that flash.
 *
 * **Session restore on mount.** The access token lives in memory only (see
 * `token-store.ts`), so a page reload loses it. The effect below exchanges
 * the HttpOnly refresh cookie for a fresh one. This is the cost of not
 * putting a long-lived credential in `localStorage`, and it is one request.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { setAuthFailureHandler } from '@/lib/api/client';
import { AuthAPI } from './auth-api';
import { clearTokens } from './token-store';
import type {
  AuthContextValue,
  AuthStatus,
  AuthUser,
  LoginCredentials,
  RegisterPayload,
} from './types';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // React 18 StrictMode mounts effects twice in development. Without this
  // guard the restore runs twice, firing two refresh calls — and with
  // refresh-token rotation on the server, the second presents a token the
  // first just invalidated, so development looks broken while production is
  // fine.
  const restoreStarted = useRef(false);

  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;

    let cancelled = false;

    (async () => {
      try {
        await AuthAPI.refreshSession();
        const currentUser = await AuthAPI.getCurrentUser();
        if (!cancelled) {
          setUser(currentUser);
          setStatus('authenticated');
        }
      } catch {
        // No valid refresh credential. This is the ordinary "not signed in"
        // case for every first-time visitor — not an error, and not worth
        // logging.
        if (!cancelled) {
          clearTokens();
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // The HTTP client calls this when a refresh fails mid-session, so React
  // state matches reality instead of rendering a signed-in UI whose every
  // request 401s.
  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      setStatus('unauthenticated');
    });
    return () => setAuthFailureHandler(null);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    // No try/catch: the caller needs the error. See the note above.
    const authenticated = await AuthAPI.login(credentials);
    setUser(authenticated);
    setStatus('authenticated');
    return authenticated;
  }, []);

  const register = useCallback(
    (payload: RegisterPayload) => AuthAPI.register(payload),
    [],
  );

  const logout = useCallback(async () => {
    // Clear local state first so the UI responds immediately; the network
    // call is best-effort and must not gate the visible sign-out.
    setUser(null);
    setStatus('unauthenticated');
    await AuthAPI.logout();
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await AuthAPI.getCurrentUser();
      setUser(currentUser);
      setStatus('authenticated');
      return currentUser;
    } catch {
      setUser(null);
      setStatus('unauthenticated');
      return null;
    }
  }, []);

  const updateProfile = useCallback(async (payload: Partial<AuthUser> | FormData) => {
    const updated = await AuthAPI.updateProfile(payload);
    setUser(updated);
    return updated;
  }, []);

  const hasPermission = useCallback(
    (codename: string) => {
      if (!user) return false;
      // A superuser holds every permission implicitly; the server does not
      // enumerate them.
      if (user.is_superuser) return true;
      return user.permissions?.includes(codename) ?? false;
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
      hasPermission,
    }),
    [user, status, login, register, logout, refreshUser, updateProfile, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
