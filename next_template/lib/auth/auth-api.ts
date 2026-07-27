'use client';

/**
 * Auth endpoint wrappers.
 *
 * Thin on purpose: no state, no toasts, no navigation. Every function either
 * returns data or throws. The context above decides what that means for the
 * UI, and the caller decides what to show. Splitting it this way is what
 * makes these testable without a React tree.
 */

import { plainApi, http, setLoggingOut } from '@/lib/api/client';
import { Endpoints } from '@/lib/api/endpoints';
import {
  clearTokens,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './token-store';
import type {
  AuthTokens,
  AuthUser,
  LoginCredentials,
  RegisterPayload,
} from './types';

/** Persist whatever the server returned. */
function storeTokens(tokens: AuthTokens): void {
  if (tokens.access) setAccessToken(tokens.access);
  // Absent in the recommended HttpOnly-cookie setup — the browser holds it.
  if (tokens.refresh) setRefreshToken(tokens.refresh);
}

export const AuthAPI = {
  /**
   * Sign in.
   *
   * Uses `plainApi`: there is no token to attach yet, and a 401 here means
   * "wrong password", not "session expired". Sending it through the
   * authenticated client would trigger the refresh interceptor and turn a
   * bad-password response into a confusing forced logout.
   */
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const data = await plainApi
      .post<AuthTokens & { user?: AuthUser }>(Endpoints.Auth.Login, credentials)
      .then((r) => r.data);

    storeTokens(data);

    // Some backends return the user with the tokens; others do not. Fetch it
    // if it is missing rather than assuming either shape.
    return data.user ?? (await AuthAPI.getCurrentUser());
  },

  async register(payload: RegisterPayload): Promise<{ detail: string }> {
    return plainApi
      .post<{ detail: string }>(Endpoints.Auth.Register, payload)
      .then((r) => r.data);
  },

  /**
   * Sign out.
   *
   * Local tokens are cleared in `finally`, so a failing server call still
   * signs the user out of this browser. The alternative — bailing out on
   * error — leaves someone who clicked "Sign out" still logged in, which is
   * the worse failure by a wide margin.
   */
  async logout(): Promise<void> {
    setLoggingOut(true);
    try {
      const refresh = getRefreshToken();
      await http.post(Endpoints.Auth.Logout, refresh ? { refresh } : {});
    } catch {
      // Already-expired token, or the server is down. Nothing to do: the
      // local teardown below is what matters to the user.
    } finally {
      clearTokens();
      setLoggingOut(false);
    }
  },

  async getCurrentUser(): Promise<AuthUser> {
    return http.get<AuthUser>(Endpoints.Auth.User);
  },

  async updateProfile(payload: Partial<AuthUser> | FormData): Promise<AuthUser> {
    return http.patch<AuthUser>(Endpoints.Auth.User, payload);
  },

  /**
   * Exchange the refresh credential for a new access token.
   *
   * Called on app mount to restore a session after a page reload — the access
   * token lives in memory only, so a refresh is how the session survives.
   * Throws when there is no valid refresh credential, which is the normal
   * "not signed in" case and must be handled, not logged as an error.
   */
  async refreshSession(): Promise<AuthTokens> {
    const stored = getRefreshToken();
    const data = await plainApi
      .post<AuthTokens>(Endpoints.Auth.TokenRefresh, stored ? { refresh: stored } : {})
      .then((r) => r.data);

    storeTokens(data);
    return data;
  },

  async requestPasswordReset(email: string): Promise<{ detail: string }> {
    return plainApi
      .post<{ detail: string }>(Endpoints.Auth.PasswordReset, { email })
      .then((r) => r.data);
  },

  async confirmPasswordReset(payload: {
    uid: string;
    token: string;
    new_password1: string;
    new_password2: string;
  }): Promise<{ detail: string }> {
    return plainApi
      .post<{ detail: string }>(Endpoints.Auth.PasswordResetConfirm, payload)
      .then((r) => r.data);
  },

  async changePassword(payload: {
    old_password: string;
    new_password1: string;
    new_password2: string;
  }): Promise<{ detail: string }> {
    return http.post<{ detail: string }>(Endpoints.Auth.PasswordChange, payload);
  },

  async verifyEmail(key: string): Promise<{ detail: string }> {
    return plainApi
      .post<{ detail: string }>(Endpoints.Auth.VerifyEmail, { key })
      .then((r) => r.data);
  },

  async resendVerification(email: string): Promise<{ detail: string }> {
    return plainApi
      .post<{ detail: string }>(Endpoints.Auth.ResendVerification, { email })
      .then((r) => r.data);
  },
};

export default AuthAPI;
