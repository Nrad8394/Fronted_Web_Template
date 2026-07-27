import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Content-Security-Policy.
 *
 * The most valuable header here by a distance: it is what turns an XSS from
 * "attacker runs arbitrary code" into "attacker's script is blocked". It is
 * also the one most likely to break your app if you copy it without reading,
 * so each directive below says what it allows and why.
 *
 * Tighten it. This policy is as strict as a template can be while still
 * working for an unknown app; a specific app can usually do better.
 */
const csp = [
  "default-src 'self'",

  // 'unsafe-inline' is required: Next.js injects inline bootstrap scripts,
  // and this template adds an inline theme script. 'unsafe-eval' is
  // development-only — Turbopack and React DevTools use eval() for HMR and
  // stack reconstruction. React itself never evals in production, so the
  // production policy omits it.
  //
  // To do better: switch to a nonce-based policy via middleware. That removes
  // 'unsafe-inline' entirely and is the meaningful upgrade here.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,

  // Tailwind and CSS-in-JS both emit inline styles. Injected CSS is a much
  // weaker primitive than injected script, so this is a reasonable trade.
  "style-src 'self' 'unsafe-inline'",

  // data: for inlined SVGs, blob: for object URLs from file downloads and
  // client-side image previews. Narrow `https:` to your actual asset hosts.
  "img-src 'self' data: blob: https:",

  "font-src 'self' data:",

  // Where the app may send requests. The API host is injected at runtime, so
  // it cannot be enumerated here — narrow this to your API origin once you
  // know it. This is the directive that limits data exfiltration, so it is
  // worth the effort.
  `connect-src 'self' https: ${isDev ? 'http://localhost:* ws://localhost:*' : ''}`,

  // No plugins, no framing, no <base> hijacking, no cross-origin form posts.
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },

  // Stops the browser guessing a content type it was not given — the
  // mechanism behind "uploaded .txt is executed as HTML".
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Superseded by frame-ancestors above, kept for older browsers.
  { key: 'X-Frame-Options', value: 'DENY' },

  // Send the full URL to your own origin, only the origin cross-site. Stops
  // paths containing ids or tokens leaking in the Referer header.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Deny hardware the app does not use, so a compromised dependency cannot
  // request it either.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

// HSTS is deliberately NOT in the list above.
//
// It is cached by the browser for the full max-age and cannot be revoked. Set
// it too early — before every subdomain serves HTTPS — and you lock users out
// of anything still on HTTP, with no way to fix it from the server. Enable it
// once you are certain, and ramp: 300, then 86400, then 31536000.
if (process.env.ENABLE_HSTS === 'true') {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  });
}

const nextConfig: NextConfig = {
  // Emits .next/standalone with a minimal node_modules — the Docker runtime
  // image is ~150 MB instead of ~1 GB. The Dockerfile depends on this.
  output: 'standalone',

  reactStrictMode: true,

  // Do not send a header advertising the framework version.
  poweredByHeader: false,

  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      {
        // Defence in depth alongside `robots` metadata: authenticated areas
        // should never be indexed, and a stray public link should not be
        // enough to get them crawled.
        source: '/dashboard/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },

  images: {
    // Explicit allowlist. Next.js will not optimise an image from a host that
    // is not listed — a deliberate restriction, since the optimiser would
    // otherwise be an open proxy that fetches arbitrary URLs on your behalf.
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      // Add your CDN / object storage here:
      // { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
  },

  eslint: {
    // Fail the build on lint errors. `ignoreDuringBuilds: true` is a tempting
    // shortcut that means nobody notices when lint has been broken for weeks.
    ignoreDuringBuilds: false,
  },

  typescript: {
    // Same reasoning. A type error that does not fail the build is a type
    // error that ships.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
