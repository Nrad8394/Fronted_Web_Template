import Link from 'next/link';

/**
 * Landing page — a Server Component.
 *
 * No `'use client'`: nothing here needs state or effects, so it renders on
 * the server and ships no JavaScript for itself. Reach for `'use client'`
 * when a component genuinely needs interactivity, not by habit.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-semibold">Next.js Starter Template</h1>
        <p className="mt-2 text-sm opacity-80">
          Runtime-configurable API client, JWT auth with a refresh mutex,
          typed react-query resources, and one error contract shared with the
          Django starter template.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        >
          Create an account
        </Link>
      </div>

      <p className="text-xs opacity-60">
        Replace this page. Start with <code>README.md</code> and{' '}
        <code>lib/api/endpoints.ts</code>.
      </p>
    </main>
  );
}
