#!/usr/bin/env bash
#
# Cloud Agent install: idempotent dependency + database bootstrap.
#
# Runs after the repository is checked out. Prepares everything a fresh agent
# needs so the terminals (data plane + services) can start:
#   - system Redis (redis-memory-server can't compile on this base image) + psql
#   - workspace dependencies (pnpm, frozen lockfile)
#   - a local .env with strong dev secrets
#   - the Prisma client and compiled shared packages (services run in dev mode
#     and import the packages' built output)
#   - an initialized embedded Postgres cluster with migrations + seed applied
#
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "[install] ensuring system packages (redis-server, postgresql-client)"
if ! command -v redis-server >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq redis-server postgresql-client
fi

echo "[install] enabling corepack / pnpm"
corepack enable >/dev/null 2>&1 || true

echo "[install] installing workspace dependencies"
pnpm install --frozen-lockfile

echo "[install] preparing .env"
node scripts/cloud/prepare-env.mjs

echo "[install] generating Prisma client"
pnpm db:generate

echo "[install] building shared workspace packages"
pnpm --filter "./packages/*" build

echo "[install] initializing database (embedded Postgres: migrate + seed)"
node scripts/cloud/db-setup.mjs

echo "[install] done"
