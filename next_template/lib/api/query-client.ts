'use client';

import { QueryClient, isServer } from '@tanstack/react-query';

import { isRetryable, normalizeError } from './errors';

/**
 * react-query defaults.
 *
 * `staleTime: 60_000` — data is considered fresh for a minute, so navigating
 * between pages does not refetch everything. react-query's own default is 0,
 * which refetches on every mount and every window focus; that is safe but
 * chatty, and on a dashboard it means a burst of requests each time the user
 * alt-tabs back.
 *
 * `refetchOnWindowFocus: false` — for the same reason. Turn it back on for
 * specific queries where staleness genuinely matters (a live queue, a
 * balance) rather than globally.
 *
 * `retry` — never retry a 4xx. The request was wrong; sending it twice more
 * just delays the error the user needs to see. Retry network failures and
 * 5xx, which are the ones that are plausibly transient.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (failureCount >= 2) return false;
          return isRetryable(normalizeError(error));
        },
        // Exponential backoff, capped. A fixed delay turns a brief outage
        // into a synchronised retry storm from every open tab.
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      },
      mutations: {
        // Mutations are not idempotent. Retrying a failed POST can create a
        // duplicate record — the request may well have succeeded with only
        // the response lost.
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * One client per browser tab; a fresh one per SSR request.
 *
 * The distinction is load-bearing. A module-level singleton would be shared
 * by every concurrent server render, so one user's fetched data could be
 * served to another. Creating a new client per server request keeps caches
 * isolated. In the browser the opposite is wanted: a singleton, so navigation
 * reuses the cache instead of refetching. Recreating it there on every render
 * would silently disable caching altogether.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
