'use client';

/**
 * Every client-side provider, in one component.
 *
 * `app/layout.tsx` stays a Server Component and renders this. That boundary
 * matters: marking the layout itself `'use client'` opts the entire route
 * tree below it out of server rendering, which costs you streaming, server
 * data fetching, and a good deal of bundle size — for the sake of a context
 * provider that only needed to be a leaf.
 *
 * Provider order is not arbitrary. `QueryClientProvider` wraps `AuthProvider`
 * because auth uses the HTTP layer; theme wraps both because it is inert.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { getQueryClient } from '@/lib/api/query-client';
import { AuthProvider } from '@/lib/auth/auth-context';
import { ThemeProvider } from '@/components/theme-provider';

export function Providers({ children }: { children: ReactNode }) {
  // Not `useState(() => new QueryClient())` and not a module constant.
  // `getQueryClient()` handles both cases correctly: a singleton in the
  // browser so navigation reuses the cache, a fresh instance per SSR request
  // so one user's data is never served to another. See query-client.ts.
  const queryClient = getQueryClient();

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
