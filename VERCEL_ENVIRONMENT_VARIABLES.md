# Vercel environment variables

Inventory derived from repository source (`process.env` usage, `apps/*/src/env.ts`, and `services/*/src/config/env.schema.ts`).  
**No real secrets are included.** Example and placeholder values are non-secret templates only.

Scan tooling used for this pass: `scripts/scan-env-usage.mjs` (unique `process.env` keys under `apps/`, `services/`, `packages/`, `scripts/`, `database/`).

---

## 1. Scope summary

| Area                              | Variables declared in app `env.ts` / Next config             | Notes                                              |
| --------------------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| **apps/web** (this Vercel deploy) | `NEXT_PUBLIC_*`, `NODE_ENV`, `DOCKER_BUILD`                  | Zod schema in `apps/web/src/env.ts`                |
| **apps/admin**                    | Same `NEXT_PUBLIC_*` set as web (name default differs)       | `apps/admin/src/env.ts`                            |
| **apps/docs**                     | Subset of `NEXT_PUBLIC_*` (no admin/CDN vars in schema)      | `apps/docs/src/env.ts`                             |
| **Backend services**              | Not deployed on Vercel by this repo’s `apps/web/vercel.json` | Required only when running Nest services elsewhere |

`apps/web/vercel.json` builds with `pnpm turbo run build --filter=@auvora/web`. It does **not** start backend services on Vercel.

---

## 2. Classification

### Required for `apps/web` deployment (Vercel)

These are the env vars **referenced by `apps/web`**.

| Variable                         | In schema?       | Zod behavior                                        | Role                                                                   |
| -------------------------------- | ---------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`            | Yes              | `z.string().url().default('http://localhost:4000')` | API gateway base URL for client fetches                                |
| `NEXT_PUBLIC_APP_NAME`           | Yes              | default `'Auvora Wallet'`                           | Document title / branding                                              |
| `NEXT_PUBLIC_APP_URL`            | Yes              | optional URL                                        | Public web app URL                                                     |
| `NEXT_PUBLIC_ADMIN_URL`          | Yes              | optional URL                                        | Link to admin                                                          |
| `NEXT_PUBLIC_DOCS_URL`           | Yes              | optional URL                                        | Link to docs                                                           |
| `NEXT_PUBLIC_STATUS_URL`         | Yes              | optional URL                                        | Status page URL                                                        |
| `NEXT_PUBLIC_MARKETING_URL`      | Yes              | optional URL                                        | Marketing site URL                                                     |
| `NEXT_PUBLIC_CDN_ASSET_BASE_URL` | Yes              | optional URL                                        | CDN asset base                                                         |
| `NODE_ENV`                       | Next runtime     | Set by Vercel (`production` on deploy)              | Security headers / prod mode in `next.config.ts`                       |
| `DOCKER_BUILD`                   | Next config only | Compared to `'true'`                                | Enables `output: 'standalone'` — **Docker only, not needed on Vercel** |

**Absolutely required to make the Next.js build succeed on Vercel:** none beyond what Vercel already injects (`NODE_ENV`). All `NEXT_PUBLIC_*` entries either default or are optional in `apps/web/src/env.ts`.

**Absolutely required for a _useful_ first `apps/web` deployment (API calls hit a real gateway):** set `NEXT_PUBLIC_API_URL` to your public API origin. Without it, the baked default is `http://localhost:4000`, which will not work in the browser on Vercel.

### Required only for `apps/admin`

No env var name is exclusive to admin. Admin uses the same `NEXT_PUBLIC_*` names as web (`apps/admin/src/env.ts`).

Practical differences for an **admin** Vercel project:

| Variable                | Why call out for admin                                      |
| ----------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_APP_NAME`  | Default in code is `'Auvora Admin'` (not `'Auvora Wallet'`) |
| `NEXT_PUBLIC_ADMIN_URL` | Should usually be this deployment’s own public URL          |
| `NEXT_PUBLIC_APP_URL`   | Often points at the consumer web app, not admin             |

### Required only for `apps/docs`

Docs schema (`apps/docs/src/env.ts`) does **not** declare:

- `NEXT_PUBLIC_ADMIN_URL`
- `NEXT_PUBLIC_CDN_ASSET_BASE_URL`

Docs-declared vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME` (default `'Auvora Docs'`), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DOCS_URL`, `NEXT_PUBLIC_STATUS_URL`, `NEXT_PUBLIC_MARKETING_URL`.  
`DOCKER_BUILD` appears only in `apps/docs/next.config.ts` (same Docker standalone toggle).

### Required only for backend services

Not used by the Vercel `apps/web` build. Required when running Nest services (local/K8s/VM).

**Shared hard requirements** (appear as non-optional `z.string().min(...)` in most service `env.schema.ts` files; gateway is softer):

| Variable             | Typical requirement                                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Required by auth, wallet, blockchain, payments, compliance, custody, notifications, analytics, ai, observability, market-data, swap, nft, staking, connections, bridge |
| `REDIS_URL`          | Same services as above                                                                                                                                                 |
| `JWT_ACCESS_SECRET`  | min 32 chars (most services)                                                                                                                                           |
| `JWT_REFRESH_SECRET` | auth only — min 32 chars                                                                                                                                               |
| `CSRF_SECRET`        | min 32 chars (most services)                                                                                                                                           |
| `INTERNAL_API_KEY`   | min 32 on most services; optional on gateway/auth/blockchain schemas                                                                                                   |
| `APP_PUBLIC_URL`     | **required** URL on auth (`z.string().url()` with no default)                                                                                                          |

**Per-service field encryption keys** (min 32 chars where declared):

| Variable                             | Service       |
| ------------------------------------ | ------------- |
| `AI_FIELD_ENCRYPTION_KEY`            | ai            |
| `ANALYTICS_FIELD_ENCRYPTION_KEY`     | analytics     |
| `COMPLIANCE_FIELD_ENCRYPTION_KEY`    | compliance    |
| `CUSTODY_FIELD_ENCRYPTION_KEY`       | custody       |
| `NOTIFICATIONS_FIELD_ENCRYPTION_KEY` | notifications |
| `OBSERVABILITY_FIELD_ENCRYPTION_KEY` | observability |
| `MARKET_DATA_FIELD_ENCRYPTION_KEY`   | market-data   |
| `SWAP_FIELD_ENCRYPTION_KEY`          | swap          |
| `NFT_FIELD_ENCRYPTION_KEY`           | nft           |
| `STAKING_FIELD_ENCRYPTION_KEY`       | staking       |
| `CONNECTIONS_FIELD_ENCRYPTION_KEY`   | connections   |
| `BRIDGE_FIELD_ENCRYPTION_KEY`        | bridge        |

Many other backend keys exist in schemas (service URLs, worker flags, Alchemy RPC, mail, OTEL, rate limits, etc.). Full schema field list from scan: **190** unique keys in `services/**/env.schema.ts` (see section 4 backend tables / `.env.example`).

### Optional variables

- All optional `NEXT_PUBLIC_*` URL/CDN fields on web/admin/docs (when omitted, schema allows `undefined`).
- `DOCKER_BUILD` for Vercel (omit; only for Docker standalone images).
- Backend optional/defaulted keys (service URLs with defaults, `OTEL_*`, worker intervals, simulator flags with defaults, provider API keys marked optional in schemas such as `AI_OPENAI_API_KEY`, `COINGECKO_API_KEY`, notification provider tokens, etc.).
- Script-only keys (not Next apps): `WEB_URL`, `ADMIN_URL`, `API_URL`, `AUTH_URL`, `WALLET_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `ADMIN_PASSWORD`, `NEXT_FORCE_CLEAN`, `ALCHEMY_LIVE_TEST`, etc. under `scripts/`.

---

## 3. First deployment of `apps/web` — absolute minimum

| Priority           | Variable                         | Must set in Vercel?           | Safe temporary placeholder?                        |
| ------------------ | -------------------------------- | ----------------------------- | -------------------------------------------------- |
| Build              | _(none)_                         | No — Zod defaults allow parse | —                                                  |
| Runtime usefulness | `NEXT_PUBLIC_API_URL`            | **Yes, for a working UI**     | Yes — public API origin placeholder (see table)    |
| Branding           | `NEXT_PUBLIC_APP_NAME`           | No                            | Optional override                                  |
| Links              | other `NEXT_PUBLIC_*` URLs       | No                            | Yes — `https://example.com/...` style placeholders |
| CDN                | `NEXT_PUBLIC_CDN_ASSET_BASE_URL` | No                            | Yes, or leave unset                                |
| Platform           | `NODE_ENV`                       | No — Vercel sets it           | —                                                  |
| Docker             | `DOCKER_BUILD`                   | **Do not set** on Vercel      | —                                                  |

**Important:** `NEXT_PUBLIC_*` values are **baked in at build time**. After changing them in Vercel, trigger a **redeploy/rebuild**.

If the API gateway is not ready yet, you may still deploy `apps/web` with a placeholder `NEXT_PUBLIC_API_URL`. The site will build and render; API-backed screens will fail network calls until a real gateway URL is configured and the app is rebuilt.

---

## 4. Master table

### 4.1 `apps/web` (Vercel project)

| Variable Name                    | Required?     | Description                                                                                                                                                                        | Example Value                    | Safe Placeholder Value (first deploy)     |
| -------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_API_URL`            | Yes\*         | Public base URL of the API gateway used by the web client (`fetch` / SDK). \*Required for useful deploy; has code default `http://localhost:4000` so build can succeed without it. | `https://api.example.com`        | `https://api.example.com`                 |
| `NEXT_PUBLIC_APP_NAME`           | No            | App display name (layout title). Defaults to `Auvora Wallet`.                                                                                                                      | `Auvora Wallet`                  | `Auvora Wallet`                           |
| `NEXT_PUBLIC_APP_URL`            | No            | Canonical public URL of this web app.                                                                                                                                              | `https://app.example.com`        | `https://app.example.com`                 |
| `NEXT_PUBLIC_ADMIN_URL`          | No            | Public URL of the admin app (links).                                                                                                                                               | `https://admin.example.com`      | `https://admin.example.com`               |
| `NEXT_PUBLIC_DOCS_URL`           | No            | Public URL of docs.                                                                                                                                                                | `https://docs.example.com`       | `https://docs.example.com`                |
| `NEXT_PUBLIC_STATUS_URL`         | No            | Status page URL.                                                                                                                                                                   | `https://app.example.com/status` | `https://app.example.com/status`          |
| `NEXT_PUBLIC_MARKETING_URL`      | No            | Marketing site URL.                                                                                                                                                                | `https://example.com`            | `https://example.com`                     |
| `NEXT_PUBLIC_CDN_ASSET_BASE_URL` | No            | Optional CDN origin for static assets.                                                                                                                                             | `https://cdn.example.com`        | leave unset, or `https://cdn.example.com` |
| `NODE_ENV`                       | No (platform) | Provided by Vercel as `production` on Production deployments. Used in `next.config.ts` for security headers.                                                                       | `production`                     | _(do not override)_                       |
| `DOCKER_BUILD`                   | No            | When `true`, Next uses `output: 'standalone'`. Intended for Docker images, not Vercel.                                                                                             | unset                            | **omit**                                  |

### 4.2 `apps/admin` only (same names; admin project settings)

| Variable Name                    | Required?     | Description                                            | Example Value                    | Safe Placeholder Value (first deploy) |
| -------------------------------- | ------------- | ------------------------------------------------------ | -------------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_API_URL`            | Yes\*         | Same as web — admin pages call `/api/v1/admin/...`.    | `https://api.example.com`        | `https://api.example.com`             |
| `NEXT_PUBLIC_APP_NAME`           | No            | Defaults to `Auvora Admin` in `apps/admin/src/env.ts`. | `Auvora Admin`                   | `Auvora Admin`                        |
| `NEXT_PUBLIC_APP_URL`            | No            | Often the consumer web URL.                            | `https://app.example.com`        | `https://app.example.com`             |
| `NEXT_PUBLIC_ADMIN_URL`          | No            | This admin deployment’s public URL.                    | `https://admin.example.com`      | `https://admin.example.com`           |
| `NEXT_PUBLIC_DOCS_URL`           | No            | Docs URL.                                              | `https://docs.example.com`       | `https://docs.example.com`            |
| `NEXT_PUBLIC_STATUS_URL`         | No            | Status URL.                                            | `https://app.example.com/status` | `https://app.example.com/status`      |
| `NEXT_PUBLIC_MARKETING_URL`      | No            | Marketing URL.                                         | `https://example.com`            | `https://example.com`                 |
| `NEXT_PUBLIC_CDN_ASSET_BASE_URL` | No            | Optional CDN base.                                     | `https://cdn.example.com`        | leave unset                           |
| `NODE_ENV`                       | No (platform) | Set by Vercel.                                         | `production`                     | _(do not override)_                   |
| `DOCKER_BUILD`                   | No            | Docker standalone only.                                | unset                            | **omit**                              |

### 4.3 `apps/docs` only

| Variable Name               | Required? | Description                                    | Example Value                    | Safe Placeholder Value (first deploy) |
| --------------------------- | --------- | ---------------------------------------------- | -------------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_API_URL`       | Yes\*     | Declared in docs `env.ts` (default localhost). | `https://api.example.com`        | `https://api.example.com`             |
| `NEXT_PUBLIC_APP_NAME`      | No        | Defaults to `Auvora Docs`.                     | `Auvora Docs`                    | `Auvora Docs`                         |
| `NEXT_PUBLIC_APP_URL`       | No        | Public docs site URL (optional).               | `https://docs.example.com`       | `https://docs.example.com`            |
| `NEXT_PUBLIC_DOCS_URL`      | No        | Docs canonical URL (optional).                 | `https://docs.example.com`       | `https://docs.example.com`            |
| `NEXT_PUBLIC_STATUS_URL`    | No        | Status URL (optional).                         | `https://app.example.com/status` | `https://app.example.com/status`      |
| `NEXT_PUBLIC_MARKETING_URL` | No        | Marketing URL (optional).                      | `https://example.com`            | `https://example.com`                 |
| `DOCKER_BUILD`              | No        | Docker standalone only.                        | unset                            | **omit**                              |

Docs schema does **not** include `NEXT_PUBLIC_ADMIN_URL` or `NEXT_PUBLIC_CDN_ASSET_BASE_URL`.

### 4.4 Backend services (not for `apps/web` Vercel project)

Shared / cross-cutting (set in the environment that runs Nest, **not** required to deploy static/SSR web on Vercel alone):

| Variable Name                               | Required?                          | Description                                                              | Example Value                                                       | Safe Placeholder Value                                            |
| ------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`                              | Yes (most services)                | Postgres connection string for Prisma.                                   | `postgresql://auvora:****@db.host:5432/auvora_wallet?schema=public` | Use a real non-prod DB URL — empty string fails schema validation |
| `REDIS_URL`                                 | Yes (most services)                | Redis URL.                                                               | `redis://:****@redis.host:6379`                                     | Real non-prod Redis URL                                           |
| `JWT_ACCESS_SECRET`                         | Yes (most services)                | Access-token signing secret (min 32).                                    | _(generate locally; do not commit)_                                 | generate with `openssl rand -base64 48`                           |
| `JWT_REFRESH_SECRET`                        | Yes (auth)                         | Refresh-token signing secret (min 32).                                   | _(generate locally; do not commit)_                                 | generate with `openssl rand -base64 48`                           |
| `CSRF_SECRET`                               | Yes (most services)                | CSRF secret (min 32).                                                    | _(generate locally; do not commit)_                                 | generate with `openssl rand -base64 32`                           |
| `INTERNAL_API_KEY`                          | Yes (most services)                | Service-to-service key (min 32 typical).                                 | _(generate locally; do not commit)_                                 | generate with `openssl rand -hex 32`                              |
| `APP_PUBLIC_URL`                            | Yes (auth)                         | Public app URL used by auth flows.                                       | `https://app.example.com`                                           | `https://app.example.com`                                         |
| `CORS_ORIGINS`                              | Gateway                            | Comma-separated allowed browser origins (gateway schema).                | `https://app.example.com,https://admin.example.com`                 | match your Vercel domains                                         |
| `NODE_ENV`                                  | Optional/defaulted                 | Service runtime mode.                                                    | `production`                                                        | `production`                                                      |
| `PORT`                                      | Optional/defaulted                 | HTTP listen port (per service default).                                  | `4000`                                                              | use each service default                                          |
| `LOG_LEVEL`                                 | Optional/defaulted                 | Pino level.                                                              | `info`                                                              | `info`                                                            |
| `OTEL_ENABLED`                              | Optional/defaulted                 | Enable OpenTelemetry.                                                    | `false`                                                             | `false`                                                           |
| `OTEL_EXPORTER_OTLP_ENDPOINT`               | Optional/defaulted                 | OTLP endpoint.                                                           | `http://localhost:4318`                                             | leave default until collector exists                              |
| `*_SERVICE_URL`                             | Mostly optional/defaulted          | Inter-service HTTP bases (`AUTH_SERVICE_URL`, `WALLET_SERVICE_URL`, …).  | `http://127.0.0.1:4001`                                             | mesh DNS / localhost defaults in schemas                          |
| `*_FIELD_ENCRYPTION_KEY`                    | Yes where declared                 | Per-domain field encryption (min 32).                                    | _(generate; do not commit)_                                         | `openssl rand -hex 32`                                            |
| `*_SIMULATOR_ENABLED` / `*_WORKERS_ENABLED` | Varies                             | Feature/worker toggles in service schemas / `.env.example`.              | `true` / `false`                                                    | prefer simulators `true` only in non-prod                         |
| `ALCHEMY_API_KEY`                           | Optional unless live RPC required  | Alchemy key (blockchain / scripts).                                      | _(provider secret; do not invent)_                                  | leave unset until live chain access needed                        |
| `ALCHEMY_*_RPC_URL`                         | Optional                           | Per-chain RPC overrides.                                                 | provider HTTPS URL                                                  | leave unset to derive from key in scripts                         |
| `MAIL_DRIVER` / `SMTP_*`                    | Optional (auth defaults `console`) | Outbound mail.                                                           | `smtp` + host                                                       | `console` for non-prod                                            |
| `OBJECT_STORAGE_*` / `CDN_ASSET_BASE_URL`   | Optional                           | Object storage / CDN (see `.env.example`).                               | bucket + region                                                     | leave unset until assets pipeline exists                          |
| `SEED_ADMIN_*`                              | Scripts / seed only                | Local/staging seed credentials in `.env.example` — **never production**. | local-only values in example file                                   | do not set on Vercel web                                          |

Full backend field catalog is large (~190 schema keys). Treat `.env.example` and `.env.production.example` as the human-maintained checklist when provisioning Nest/Helm — those files mirror schema + ops needs without being loaded by the Vercel web build.

### 4.5 Script / tooling only (not `apps/web` Vercel)

| Variable Name                                                 | Required? | Description                                                            | Example Value                  | Safe Placeholder |
| ------------------------------------------------------------- | --------- | ---------------------------------------------------------------------- | ------------------------------ | ---------------- |
| `WEB_URL`                                                     | No        | Preview/a11y scripts (`scripts/preview-health.mjs`, `a11y-smoke.mjs`). | `http://127.0.0.1:3000`        | local default    |
| `ADMIN_URL`                                                   | No        | Same for admin.                                                        | `http://127.0.0.1:3001`        | local default    |
| `API_URL`                                                     | No        | Perf/staging scripts gateway base.                                     | `http://localhost:4000`        | local default    |
| `AUTH_URL` / `WALLET_URL`                                     | No        | Perf suite service bases.                                              | localhost ports                | local defaults   |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `ADMIN_PASSWORD` | No        | Journey smoke auth (`scripts/perf/journey-smoke.mjs`).                 | from `.env.example` seed block | local only       |
| `NEXT_FORCE_CLEAN`                                            | No        | `scripts/next-production-build.mjs` clean behavior.                    | `0` to skip                    | omit             |
| `PATH`                                                        | No        | Inherited by migrate helper scripts.                                   | OS path                        | n/a              |

---

## 5. Recommended Vercel UI checklist for first `apps/web` deploy

Set these on the **web** Vercel project (Production + Preview as appropriate):

1. `NEXT_PUBLIC_API_URL` = your API origin, or temporary `https://api.example.com` if the gateway is not live yet
2. Optionally: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, other link URLs
3. Do **not** add Nest secrets (`DATABASE_URL`, `JWT_*`, etc.) to the web project unless you later add server routes that need them — **current `apps/web` code does not read those via `env.ts`**
4. Redeploy after any `NEXT_PUBLIC_*` change

---

## 6. Evidence map (source files)

| Concern                                           | Source                                                                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Web env schema                                    | `apps/web/src/env.ts`                                                                                                                         |
| Admin env schema                                  | `apps/admin/src/env.ts`                                                                                                                       |
| Docs env schema                                   | `apps/docs/src/env.ts`                                                                                                                        |
| Web Next config (`NODE_ENV`, `DOCKER_BUILD`)      | `apps/web/next.config.ts`                                                                                                                     |
| Direct `process.env.NEXT_PUBLIC_API_URL` in pages | e.g. `apps/web/src/app/market/page.tsx`, `apps/web/src/app/connections/page.tsx`, `apps/web/src/components/dashboard/DashboardExperience.tsx` |
| Vercel build entry                                | `apps/web/vercel.json`                                                                                                                        |
| Backend schemas                                   | `services/*/src/config/env.schema.ts`                                                                                                         |
| Ops template                                      | `.env.example`, `.env.production.example`                                                                                                     |
| Machine scan output                               | `.verify-logs/env-scan.json` (local generate via `node scripts/scan-env-usage.mjs`)                                                           |

---

## 7. Explicit non-goals / safety

- This document does **not** invent API keys or paste live credentials.
- Placeholder domains use `example.com` consistent with repo deploy templates.
- Deploying `apps/web` alone does **not** satisfy backend runtime requirements; wallet features that call the API need a reachable gateway configured via `NEXT_PUBLIC_API_URL`.
