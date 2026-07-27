/**
 * Auth types.
 *
 * `AuthUser` is intentionally minimal — the fields any Django/dj-rest-auth
 * backend provides. Extend it for your project rather than replacing it.
 *
 * A note on what does *not* belong here: the previous version of this
 * template shipped a `User` interface with `referral_code` and `referred_by`
 * on it. Those are one product's domain concepts sitting in the type every
 * consumer of the template inherits — so every project starts by deleting
 * fields, or worse, leaves them and confuses the next reader. Domain fields
 * go in a domain type that extends this one.
 */

export interface AuthTokens {
  access: string;
  /** Absent when the server sets an HttpOnly refresh cookie instead. */
  refresh?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  date_joined?: string;
  last_login?: string | null;
  /** Server-computed permission codenames (`app.view_model`). */
  permissions?: string[];
  /** Single role, when the project uses a role field. */
  role?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  // dj-rest-auth's registration serializer names these `password1`/`password2`
  // and rejects `password`/`password_confirm`. Matching the server's names
  // here — rather than renaming in a mapping layer at request time — keeps
  // the form, the type, and the wire format identical.
  password1: string;
  password2: string;
  first_name?: string;
  last_name?: string;
  [key: string]: unknown;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** True only while the initial session restore is running. */
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<{ detail: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  updateProfile: (payload: Partial<AuthUser> | FormData) => Promise<AuthUser>;

  /** Codename check against `user.permissions`. */
  hasPermission: (codename: string) => boolean;
}
