'use client';

/**
 * Sign in.
 *
 * The point of this page in the template is the error handling. It shows the
 * full round trip: the backend's error envelope arrives, `normalizeError`
 * turns it into `{ message, fieldErrors }`, field errors attach to inputs and
 * anything object-level becomes a form-level message. No status-code
 * branching, no guessing at response shapes.
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

import { normalizeError, type FieldError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { GuestRoute } from '@/components/auth/protected-route';
import { Field } from '@/components/ui/field';

/**
 * Only follow a redirect target that is a site-relative path.
 *
 * `?next=https://evil.example.com` on a login page is an open redirect: the
 * link looks like yours, the user signs in, and lands on the attacker's
 * lookalike. The `//` check matters too — `//evil.com` is protocol-relative
 * and navigates off-site despite starting with a slash.
 */
function safeRedirect(target: string | null, fallback = '/dashboard'): string {
  if (!target) return fallback;
  if (!target.startsWith('/') || target.startsWith('//')) return fallback;
  return target;
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorFor = (field: string) =>
    fieldErrors.find((e) => e.field === field)?.message ?? null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors([]);
    setFormError(null);
    setSubmitting(true);

    try {
      await login({ email, password });
      router.replace(safeRedirect(searchParams.get('next')));
    } catch (error) {
      // login() rejects rather than swallowing — which is what makes this
      // block possible at all. See the note in auth-context.tsx.
      const normalized = normalizeError(error);
      setFieldErrors(normalized.fieldErrors);

      // Show the summary only when no field error already explains it,
      // otherwise the same message appears twice.
      const hasFieldError = normalized.fieldErrors.some((e) => e.field);
      if (!hasFieldError) setFormError(normalized.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold">Sign in</h1>

      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </div>
        )}

        <Field
          label="Email"
          type="email"
          name="email"
          // Lets password managers recognise the field.
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errorFor('email')}
          required
        />

        <Field
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errorFor('password')}
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-4 flex justify-between text-sm">
        <Link href="/forgot-password" className="underline">
          Forgot password?
        </Link>
        <Link href="/register" className="underline">
          Create an account
        </Link>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <GuestRoute>
      {/*
        useSearchParams() forces the nearest Suspense boundary to render on
        the client. Without one, `next build` fails the whole route with
        "useSearchParams should be wrapped in a suspense boundary" — a common
        first deployment failure that never shows up in `next dev`.
      */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </GuestRoute>
  );
}
