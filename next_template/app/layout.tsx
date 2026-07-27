import type { Metadata } from 'next';
import Script from 'next/script';

import { Providers } from '@/components/providers';
import { THEME_INIT_SCRIPT } from '@/components/theme-provider';

import './globals.css';

/*
 * Fonts: a system stack, not `next/font/google`.
 *
 * `next/font/google` downloads the font files at BUILD time. That is fine on
 * a laptop and a problem everywhere else it matters:
 *
 *   - `docker build` with no egress fails outright
 *   - CI behind a proxy fails, intermittently, with a message about webpack
 *   - an air-gapped or offline build cannot run at all
 *
 * A system stack costs nothing to download, adds nothing to the bundle, and
 * cannot cause a layout shift because there is no swap. It also renders in
 * the typeface each platform already tuned for its own rendering stack.
 *
 * To use a real font, vendor the files and use `next/font/local` — which
 * reads from disk and keeps the build hermetic:
 *
 *     import localFont from 'next/font/local';
 *     const sans = localFont({
 *       src: './fonts/Inter.woff2',
 *       variable: '--font-sans',
 *       display: 'swap',
 *     });
 *
 * Reach for `next/font/google` only if you are certain every build
 * environment has internet access, forever.
 */

// Replace these. `metadataBase` is what makes relative Open Graph image paths
// resolve to absolute URLs — without it, social previews silently break in
// production while looking fine locally.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'App',
    template: '%s · App',
  },
  description: 'Describe your application here.',
};

/**
 * Root layout — a Server Component.
 *
 * It stays one deliberately. Adding `'use client'` here would opt every route
 * below out of server rendering; all the client-side state lives in
 * `<Providers>` instead, which is a leaf.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script below mutates <html> before
    // React hydrates, so the mismatch React reports here is expected. See
    // components/theme-provider.tsx.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Runtime configuration, written by docker-entrypoint.sh at container
          start. beforeInteractive guarantees window.__ENV__ exists before any
          application code reads it.

          In `next dev` this file does not exist and the request 404s
          harmlessly — lib/env.ts falls back to process.env. Add
          `public/env-config.js` to .gitignore: it is generated per
          environment and committing it defeats the whole mechanism.
        */}
        <Script src="/env-config.js" strategy="beforeInteractive" />

        {/*
          Applies the stored theme before first paint. Must be inline and
          blocking — anything deferred renders the wrong colours first and
          corrects them, which is the flash this prevents.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
