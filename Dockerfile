# syntax=docker/dockerfile:1
#
# Root Dockerfile for Railway auto-detection ("Using detected Dockerfile!").
# Canonical copy lives at infrastructure/docker/Dockerfile.service — keep in sync.
# Prefer railway.toml [build].dockerfilePath for explicit monorepo deploys.
#
# Build: docker build --build-arg SERVICE=auth --build-arg PORT=4001 .
#
# Production NestJS service image (multi-stage, non-root, pnpm monorepo-safe).
# Build: docker build -f infrastructure/docker/Dockerfile.service --build-arg SERVICE=gateway -t auvora/gateway-service:latest .

FROM node:22-alpine AS base
WORKDIR /app
# Skip husky prepare; align with packageManager/engines (pnpm@9.15.9, node>=22).
ENV CI=true
RUN corepack enable \
  && apk add --no-cache libc6-compat openssl

FROM base AS deps
# argon2 (auth / database-schema) needs a native toolchain on Alpine.
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
# Workspace member `database` (@auvora/database-schema) is required by pnpm-workspace.yaml
# and by all Nest services that depend on @auvora/database.
COPY database/package.json ./database/
COPY scripts ./scripts
# pnpm-workspace includes apps/* — package.json stubs required for --frozen-lockfile.
COPY apps/admin/package.json ./apps/admin/
COPY apps/docs/package.json ./apps/docs/
COPY apps/web/package.json ./apps/web/
COPY services/gateway/package.json ./services/gateway/
COPY services/auth/package.json ./services/auth/
COPY services/wallet/package.json ./services/wallet/
COPY services/blockchain/package.json ./services/blockchain/
COPY services/payments/package.json ./services/payments/
COPY services/compliance/package.json ./services/compliance/
COPY services/notifications/package.json ./services/notifications/
COPY services/analytics/package.json ./services/analytics/
COPY services/ai/package.json ./services/ai/
COPY services/custody/package.json ./services/custody/
COPY services/observability/package.json ./services/observability/
COPY services/market-data/package.json ./services/market-data/
COPY services/swap/package.json ./services/swap/
COPY services/nft/package.json ./services/nft/
COPY services/staking/package.json ./services/staking/
COPY services/connections/package.json ./services/connections/
COPY services/bridge/package.json ./services/bridge/
RUN pnpm install --frozen-lockfile

FROM deps AS build
# No default for SERVICE — missing Railway Variable must fail the build loudly.
ARG SERVICE
ARG PORT=4000
RUN set -eu; \
  if [ -z "${SERVICE}" ]; then \
    echo "ERROR: SERVICE build-arg/Variable is required (e.g. auth, gateway, wallet)." >&2; \
    echo "Set SERVICE and PORT as Railway service Variables (config-as-code has no buildArgs)." >&2; \
    exit 1; \
  fi; \
  case "${SERVICE}" in \
    gateway|auth|wallet|blockchain|payments|compliance|notifications|analytics|ai|custody|observability|market-data|swap|nft|staking|connections|bridge) ;; \
    *) \
      echo "ERROR: Unknown SERVICE='${SERVICE}'. Expected a directory under services/." >&2; \
      exit 1; \
      ;; \
  esac; \
  if [ ! -f "services/${SERVICE}/package.json" ]; then \
    echo "ERROR: services/${SERVICE}/package.json missing from build context (check .dockerignore)." >&2; \
    exit 1; \
  fi; \
  echo "Building @auvora/${SERVICE}-service (PORT=${PORT})"
COPY database ./database
COPY services/${SERVICE} ./services/${SERVICE}
# Generate Linux Prisma engines inside the image (do not use the Windows-oriented ensure script).
RUN pnpm --filter @auvora/database-schema exec prisma generate
RUN pnpm turbo run build --filter=@auvora/${SERVICE}-service
# Root node_modules alone cannot resolve Nest deps under pnpm (deps live under
# services/<name>/node_modules → .pnpm). `pnpm deploy` materializes a portable bundle.
RUN set -eu; \
  pnpm --filter="@auvora/${SERVICE}-service" deploy --prod /deploy; \
  if [ ! -f /deploy/dist/main.js ]; then \
    echo "ERROR: /deploy/dist/main.js missing after pnpm deploy (nest build output not packaged)." >&2; \
    exit 1; \
  fi; \
  node -e "const {createRequire}=require('module'); const r=createRequire('/deploy/package.json'); r('@nestjs/common'); r('@auvora/database'); console.log('deploy bundle ok');"

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV CI=true
ARG PORT=4000
ENV PORT=${PORT}
RUN addgroup -S auvora && adduser -S auvora -G auvora \
  && apk add --no-cache wget libc6-compat openssl
COPY --from=build --chown=auvora:auvora /deploy ./
USER auvora
EXPOSE ${PORT}
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "dist/main.js"]
