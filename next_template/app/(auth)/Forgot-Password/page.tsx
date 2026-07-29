'use client';

/**
 * Request a password-reset email.
 *
 * One detail worth keeping: the success state is shown whether or not the
 * address exists. Reporting "no account with that email" turns this form into
 * an account-enumeration oracle — anyone can test a list of addresses against
 * your user base, which is useful for credential stuffing and for confirming
 * that a particular person uses your service.
 *
 * The Django template's reset endpoint returns the same response either way,
 * so the two halves agree. If your backend differs, fix the backend; papering
 * over it here still leaks through response timing.
 */

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { AuthAPI } from '@/lib/auth/auth-api';
import { normalizeError } from '@/lib/api/errors';
import { Field } from '@/components/ui/field';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await AuthAPI.requestPasswordReset(email);
      setSent(true);
    } catch (error) {
      const normalized = normalizeError(error);
      // A 4xx here is a malformed address or a rate limit — both worth
      // showing. It is not "no such user"; see the note above.
      setFormError(normalized.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
        <h1 className="mb-3 text-2xl font-semibold">Check your email</h1>
        <p className="mb-6 text-sm opacity-80">
          If an account exists for {email}, a reset link is on its way. The
          link expires shortly, so use it soon.
        </p>
        <Link href="/login" className="text-sm underline">
          Back to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-semibold">Reset your password</h1>
      <p className="mb-6 text-sm opacity-80">
        Enter your email and we will send you a link.
      </p>

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <Link href="/login" className="mt-4 text-sm underline">
        Back to sign in
      </Link>
    </main>
  );
}
