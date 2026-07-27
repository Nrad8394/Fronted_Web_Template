#!/bin/sh
# =============================================================================
# Writes runtime configuration before the server starts.
#
# Next.js inlines every `process.env.NEXT_PUBLIC_*` reference at BUILD time,
# so those values are frozen into the JS bundle. This script writes them to
# /app/public/env-config.js instead, which app/layout.tsx loads with
# `strategy="beforeInteractive"` — so the browser reads them at RUNTIME and
# one image can be promoted from staging to production unchanged.
#
# To add a variable:
#   1. here
#   2. the Window.__ENV__ interface in lib/env.ts
#   3. an accessor in lib/env.ts
#   4. .env.example
#
# Note what must NOT go here: anything secret. This file is served to every
# visitor. `NEXT_PUBLIC_` is the marker for "public"; treat it literally.
# =============================================================================
set -eu

ENV_FILE=/app/public/env-config.js

cat > "${ENV_FILE}" <<EOF
// Generated at container start by docker-entrypoint.sh. Do not edit or commit.
window.__ENV__ = {
  NEXT_PUBLIC_API_URL: "${NEXT_PUBLIC_API_URL:-/api}",
  NEXT_PUBLIC_APP_NAME: "${NEXT_PUBLIC_APP_NAME:-App}",
  NEXT_PUBLIC_APP_ENV: "${NEXT_PUBLIC_APP_ENV:-production}"
};
EOF

echo "[entrypoint] wrote ${ENV_FILE} (api=${NEXT_PUBLIC_API_URL:-/api})"

exec "$@"
