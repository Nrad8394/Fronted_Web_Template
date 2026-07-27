'use client';

/**
 * Set a new password from an emailed link.
 *
 * The route carries `uid` and `token` as path segments rather than query
 * parameters. That is deliberate: query strings end up in `Referer` headers,
 * in analytics, and in server access logs far more readily than path
 * segments do — and this particular value is a single-use credential for
 * taking over an account. Path segments are not private either, but they leak
 * through fewer channels.
 *
 * The matching Django URL is
 * `/reset-password/<uid>/<token>/`, built by the backend's password-reset
 * email template.
 */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { AuthAPI } from '@/lib/auth/auth-api';
import { normalizeError, type FieldError } from '@/lib/api/errors';
import { Field } from '@/components/ui/field';

export default function ResetPasswordPage() {
  const params = useParams<{ uid: string; token: string }>();
  const router = useRouter();

  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorFor = (field: string) =>
    fieldErrors.find((e) => e.field === field)?.message ?? null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors([]);
    setFormError(null);

    if (password1 !== password2) {
      setFieldErrors([
        { field: 'new_password2', code: 'mismatch', message: 'Passwords do not match.' },
      ]);
      return;
    }

    setSubmitting(true);
    try {
      await AuthAPI.confirmPasswordReset({
        uid: params.uid,
        token: params.token,
        new_password1: password1,
        new_password2: password2,
      });
      // Not signed in automatically. The link may have been forwarded, sat in
      // a shared inbox, or been opened on a device that is not the user's —
      // knowing the reset token should not be the same as holding a session.
      router.replace('/login?reset=1');
    } catch (error) {
      const normalized = normalizeError(error);
      setFieldErrors(normalized.fieldErrors);
      if (!normalized.fieldErrors.some((e) => e.field)) {
        setFormError(
          // An expired or already-used link is the most common failure here
          // and the generic message does not tell the user what to do.
          normalized.status === 400
            ? 'This reset link is invalid or has expired. Request a new one.'
            : normalized.message,
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold">Choose a new password</h1>

      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
          >
            {formError}{' '}
            <Link href="/forgot-password" className="underline">
              Request a new link
            </Link>
          </div>
        )}

        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password1}
          onChange={(e) => setPassword1(e.target.value)}
          error={errorFor('new_password1')}
          hint="At least 8 characters."
          required
        />

        <Field
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          error={errorFor('new_password2')}
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </main>
  );
}
