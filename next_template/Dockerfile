# syntax=docker/dockerfile:1.7
# =============================================================================
# Next.js — production image (standalone output)
#
# Stages: base → deps → builder → runner
# Final image ≈150 MB rather than ≈1 GB, because `output: 'standalone'` in
# next.config.ts emits a self-contained server with a traced, minimal
# node_modules instead of the full dependency tree.
#
#   docker build -t myapp-web:latest .
#   docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=https://api.example.com myapp-web
# =============================================================================

ARG NODE_VERSION=22
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION


# =============================================================================
# STAGE 1 — base
# =============================================================================
FROM node:${NODE_VERSION}-alpine AS base
# libc6-compat: some native npm modules expect glibc symbols that musl lacks.
RUN apk add --no-cache libc6-compat dumb-init
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1


# =============================================================================
# STAGE 2 — deps
#
# Only the manifests are copied, so this layer survives every source change.
# `npm ci` (not `npm install`) installs exactly the lockfile: reproducible,
# and it fails loudly if package.json and package-lock.json have drifted
# rather than silently resolving something new.
# =============================================================================
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts


# =============================================================================
# STAGE 3 — builder
#
# NEXT_PUBLIC_* build args are OPTIONAL here. They are baked into the bundle
# as a fallback for code paths that read config before env-config.js has run
# (server-side rendering, mainly). The runtime injection in the entrypoint
# still wins in the browser, which is what keeps the image environment-
# agnostic. Never pass a secret as a build arg: it is recoverable from the
# image history.
# =============================================================================
FROM base AS builder

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build


# =============================================================================
# STAGE 4 — runner
#
# Nothing from the build survives except the three directories Next.js needs.
# No source, no devDependencies, no npm cache.
# =============================================================================
FROM node:${NODE_VERSION}-alpine AS runner

RUN apk add --no-cache dumb-init curl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# standalone bundles its own server.js and traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets are NOT included in standalone output and must be copied
# separately. Omitting this line produces an app that boots fine and renders
# completely unstyled — a genuinely confusing first Docker deployment.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# The entrypoint writes public/env-config.js at start, so this directory must
# be writable by the runtime user.
RUN chown -R nextjs:nodejs /app/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3000/ || exit 1

LABEL org.opencontainers.image.created="${BUILD_DATE:-unknown}" \
      org.opencontainers.image.revision="${VCS_REF:-unknown}" \
      org.opencontainers.image.version="${VERSION:-unknown}" \
      org.opencontainers.image.title="next-starter-template" \
      org.opencontainers.image.base.name="node:${NODE_VERSION}-alpine"

# dumb-init as PID 1 so SIGTERM reaches node and the container drains rather
# than being SIGKILLed after the grace period.
ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
