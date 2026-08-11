# Docker images (Nest services + Next apps)

## NestJS services — `Dockerfile.service`

Shared multi-stage image for every Nest service in this monorepo.

```bash
docker build -f infrastructure/docker/Dockerfile.service \
  --build-arg SERVICE=auth \
  --build-arg PORT=4001 \
  -t auvora/auth-service:latest .
```

| Arg / Variable | Required    | Notes                                                                         |
| -------------- | ----------- | ----------------------------------------------------------------------------- |
| `SERVICE`      | **yes**     | Directory name under `services/` (no default — missing value fails the build) |
| `PORT`         | recommended | Defaults to `4000` if unset; set explicitly per service                       |

Turbo filter is `@auvora/${SERVICE}-service` (so `SERVICE=market-data` → `@auvora/market-data-service`).

### Closed Beta SERVICE / PORT matrix

| SERVICE       | PORT   | Public networking |
| ------------- | ------ | ----------------- |
| `gateway`     | `4000` | **Public**        |
| `auth`        | `4001` | Private           |
| `wallet`      | `3002` | Private           |
| `blockchain`  | `3003` | Private           |
| `connections` | `3016` | Private           |
| `market-data` | `3012` | Private           |

### Railway (multi-service monorepo)

- One root `railway.toml` pins `builder = DOCKERFILE` and `dockerfilePath = infrastructure/docker/Dockerfile.service`.
- Railway **config-as-code does not support `buildArgs`**. Set `SERVICE` and `PORT` as **per-service Variables**; Railway injects matching `ARG`s at build time.
- Root Directory must be repo root (`/` / blank) for every Nest service.
- Shared `[deploy].healthcheckPath = "/health"` is correct — all Nest services expose `GET /health`.
- Root `Dockerfile` is a sync mirror for auto-detection only; prefer `railway.toml`.
- `.railwayignore` is not used here (Docker builds honor `.dockerignore`).

Validate COPY stubs before pushing Dockerfile changes:

```bash
node infrastructure/docker/validate-service-context.mjs
```

### Image contract

- Node **22** Alpine · Corepack **pnpm@9.15.9** (from root `packageManager`)
- `pnpm install --frozen-lockfile` then `prisma generate` then `turbo build` then `pnpm deploy --prod`
- Runtime: non-root `auvora`, `CMD ["node", "dist/main.js"]`, Docker `HEALTHCHECK` on `/health`
- No secrets baked into the image

## One-shot migrations — `Dockerfile.migrate`

Temporary Railway service **`db-migrate`**: runs Prisma `migrate deploy` then `migrate status` and exits. No HTTP server, no `PORT`, no reset/push/seed.

Installs **only** `@auvora/database-schema` (Prisma + argon2) via `pnpm install --ignore-workspace --frozen-lockfile --lockfile-dir=..` — not the full monorepo. Root-only `redis-memory-server` / `embedded-postgres` are never installed (their postinstalls break Alpine).

**Critical:** root `railway.toml` pins Nest → `Dockerfile.service`. Config-as-code overrides the dashboard, so a dashboard-only Dockerfile path to `Dockerfile.migrate` is **ignored** unless db-migrate uses a dedicated config file.

```bash
docker build -f infrastructure/docker/Dockerfile.migrate -t auvora/db-migrate:latest .
```

| Setting              | Value                                                            |
| -------------------- | ---------------------------------------------------------------- |
| Root Directory       | blank / `/`                                                      |
| **Config as Code**   | **`/railway.migrate.toml`** (required — not root `railway.toml`) |
| Dockerfile path      | pinned by `railway.migrate.toml` → `Dockerfile.migrate`          |
| Custom start command | **empty** (image CMD)                                            |
| Networking           | Private                                                          |
| Variables            | **`DATABASE_URL` only** (Postgres plugin reference)              |
| Restart policy       | Never (in `railway.migrate.toml`)                                |
| After success        | Tear down / remove the temporary service                         |

Optional backup variable (only if not using `railway.migrate.toml`):  
`RAILWAY_DOCKERFILE_PATH=infrastructure/docker/Dockerfile.migrate`  
Prefer the dedicated config file — root `railway.toml` would still win over the variable when the service uses the default config path.

Do **not** point Nest services at this Dockerfile or at `railway.migrate.toml`. Do **not** set Redis/JWT/Alchemy on this service.

## Next.js apps — `Dockerfile.next`

Separate image for `apps/web` and `apps/admin`. Do not point Nest Railway services at this file.
