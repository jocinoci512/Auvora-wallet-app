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

- Root `railway.toml` pins Nest mesh services (`auth`, `wallet`, …) to `Dockerfile.service`.
- **`gateway-prod`** uses dedicated **`/railway.gateway.toml`** (same Dockerfile; clean Variables; leave broken `gateway` untouched).
- **`blockchain-prod`** uses dedicated **`/railway.blockchain.toml`** (`SERVICE=blockchain`, `PORT=3003`, private networking).
- Railway **config-as-code does not support `buildArgs`**. Set `SERVICE` and `PORT` as **per-service Variables**; Railway injects matching `ARG`s at build time (`ARG` before first `FROM` + redeclare per stage in `Dockerfile.service`).
- Root Directory must be repo root (`/` / blank) for every Nest service.
- Shared `[deploy].healthcheckPath = "/health"` is correct — all Nest services expose `GET /health`.
- Root `Dockerfile` is a sync mirror for auto-detection only; prefer config-as-code files.
- `.railwayignore` is not used here (Docker builds honor `.dockerignore`).

Validate COPY stubs before pushing Dockerfile changes:

```bash
node infrastructure/docker/validate-service-context.mjs
```

### Image contract

- Node **22** Alpine · Corepack **pnpm@9.15.9** (from root `packageManager`)
- `pnpm install --frozen-lockfile` then `prisma generate` then `turbo build` then `pnpm deploy --prod`
- Root `redis-memory-server` / `embedded-postgres` stay in the lockfile for local scripts but are listed in `package.json#pnpm.neverBuiltDependencies` so their postinstall **never runs** in Docker/CI (Alpine has no Redis compiler toolchain).
- Runtime: non-root `auvora`, `CMD ["node", "dist/main.js"]`, Docker `HEALTHCHECK` on `/health`
- No secrets baked into the image

## One-shot migrations — `Dockerfile.migrate`

Temporary Railway service **`db-migrate`**: runs Prisma `migrate deploy` then `migrate status` and exits. No HTTP server, no `PORT`, no reset/push/seed.

Installs **only** `database/package.json` deps inside `/app/database` with a normal pnpm layout (exact `prisma@6.5.0`). Does **not** use monorepo `--ignore-workspace --lockfile-dir=..` (that broke `@prisma/engines` postinstall with ENOENT). Does **not** install root `redis-memory-server`.

`database/package.json` declares `"packageManager": "pnpm@9.15.9"` (same as root). The migrate image also sets `COREPACK_DEFAULT_TO_LATEST=0` and asserts `pnpm --version == 9.15.9` so Corepack cannot drift to pnpm 11.x.

Base image: `node:22-bookworm-slim` (Prisma engine–friendly; Nest services stay on Alpine `Dockerfile.service`).

**Critical:** root `railway.toml` pins Nest → `Dockerfile.service`. Config-as-code overrides the dashboard, so db-migrate **must** use `/railway.migrate.toml`.

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
