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

## Next.js apps — `Dockerfile.next`

Separate image for `apps/web` and `apps/admin`. Do not point Nest Railway services at this file.
