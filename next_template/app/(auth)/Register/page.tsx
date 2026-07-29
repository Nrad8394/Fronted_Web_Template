'use client';

/**
 * Create an account.
 *
 * Note the payload field names: `password1` / `password2`, matching
 * dj-rest-auth's `RegisterSerializer` exactly. The template deliberately does
 * not use friendlier names and remap them before sending.
 *
 * Renaming looks harmless and costs you the error path: the server reports
 * validation failures against *its* field names, so a mismatch means
 * `password1: "This password is too common"` cannot be attached to any input
 * on the form. The message either lands nowhere or gets a fragile lookup
 * table maintained by hand. Matching names end-to-end is what lets
 * `normalizeError` map errors onto fields with no translation layer.
 */

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { normalizeError, type FieldError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { GuestRoute } from '@/components/auth/protected-route';
import { Field } from '@/components/ui/field';

export default function RegisterPage() {
  const { register } = useAuth();

  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password1: '',
    password2: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorFor = (field: string) =>
    fieldErrors.find((e) => e.field === field)?.message ?? null;

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors([]);
    setFormError(null);
    setSubmitting(true);

    // Checked client-side purely so the user gets the answer without a round
    // trip. The server checks it too — client-side validation is a
    // convenience and never a guarantee.
    if (form.password1 !== form.password2) {
      setFieldErrors([
        { field: 'password2', code: 'mismatch', message: 'Passwords do not match.' },
      ]);
      setSubmitting(false);
      return;
    }

    try {
      const response = await register(form);
      setDone(
        response.detail ||
          'Account created. Check your email to verify your address.',
      );
    } catch (error) {
      const normalized = normalizeError(error);
      setFieldErrors(normalized.fieldErrors);
      if (!normalized.fieldErrors.some((e) => e.field)) {
        setFormError(normalized.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
        <h1 className="mb-3 text-2xl font-semibold">Check your email</h1>
        <p className="mb-6 text-sm opacity-80">{done}</p>
        <Link href="/login" className="text-sm underline">
          Back to sign in
        </Link>
      </main>
    );
  }

  return (
    <GuestRoute>
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
        <h1 className="mb-6 text-2xl font-semibold">Create an account</h1>

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
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            error={errorFor('email')}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="First name"
              autoComplete="given-name"
              value={form.first_name}
              onChange={update('first_name')}
              error={errorFor('first_name')}
            />
            <Field
              label="Last name"
              autoComplete="family-name"
              value={form.last_name}
              onChange={update('last_name')}
              error={errorFor('last_name')}
            />
          </div>

          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password1}
            onChange={update('password1')}
            error={errorFor('password1')}
            hint="At least 8 characters."
            required
          />

          <Field
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={form.password2}
            onChange={update('password2')}
            error={errorFor('password2')}
            required
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      </main>
    </GuestRoute>
  );
}
