'use client';

/**
 * An authenticated page.
 *
 * Kept minimal on purpose — it is a working reference for the three things
 * every page in your app will do: guard the route, read the current user, and
 * sign out. Replace the body with your own.
 */

import { useRouter } from 'next/navigation';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { useAuth } from '@/lib/auth/auth-context';
import { useTheme } from '@/components/theme-provider';

function Dashboard() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  async function handleSignOut() {
    await logout();
    router.replace('/login');
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <select
            aria-label="Theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            className="rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm dark:border-gray-700"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <button
            onClick={handleSignOut}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm dark:border-gray-700"
          >
            Sign out
          </button>
        </div>
      </div>

      <p className="text-sm opacity-80">
        Signed in as <strong>{user?.email}</strong>
      </p>

      {/*
        Where a real page goes. The resource hooks give you a table's worth of
        behaviour in a few lines:

          const products = createResource<Product>(Endpoints.Example.List);
          const { data, isLoading } = products.useList({ page, search });

        See lib/api/hooks.ts.
      */}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
