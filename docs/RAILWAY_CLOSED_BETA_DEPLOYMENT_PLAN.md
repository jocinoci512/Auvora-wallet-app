# Auvora — Railway Closed Beta Deployment Plan

**Date:** 2026-08-03  
**Workspace:** `D:\auvora-wallet`  
**Target host:** Railway (managed Docker)  
**Constraints honored:** No deploy · No Railway resource creation · No DNS · No broadcast · No commit/push · No Nest→serverless · Helm retained · NFT ABSENT

**Related:** [`RAILWAY_SERVICE_MATRIX.md`](./RAILWAY_SERVICE_MATRIX.md) · [`RAILWAY_ENVIRONMENT_MATRIX.md`](./RAILWAY_ENVIRONMENT_MATRIX.md) · [`PRODUCTION_BACKEND_INFRASTRUCTURE_REQUIREMENTS.md`](./PRODUCTION_BACKEND_INFRASTRUCTURE_REQUIREMENTS.md) · [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md)

---

## Executive posture

| Surface              | Host                                       | Closed Beta status                   |
| -------------------- | ------------------------------------------ | ------------------------------------ |
| Web (`apps/web`)     | Vercel · `auvorawallet.com`                | Live (ops-owned)                     |
| Nest API mesh        | **Railway** long-lived containers          | **Prepared — not deployed**          |
| Postgres 16 + citext | Railway Postgres **or** external managed   | Spec ready; provision at deploy time |
| Redis 7              | Railway Redis **or** external managed      | Spec ready; provision at deploy time |
| Live broadcast       | Kill-switched OFF                          | Confirmed                            |
| NFT                  | ABSENT (gateway **410**; do not run `nft`) | Confirmed                            |
| Helm / K8s           | **OPTIONAL** for Closed Beta; keep chart   | Unchanged                            |

Architecture contract: **Vercel web → public gateway only → private Nest services → managed Postgres + Redis**.

---

## 1. Service audit (17 Nest) → Railway deployment matrix

All services: NestJS 11 · `nest build` → `node dist/main.js` · shared image `infrastructure/docker/Dockerfile.service` (`SERVICE` + `PORT` build-args) · `/health` (liveness) + `/ready` (readiness).

| Service         | Dir                      | Port     | Public?    | Closed Beta                  | Railway role                  |
| --------------- | ------------------------ | -------- | ---------- | ---------------------------- | ----------------------------- |
| **gateway**     | `services/gateway`       | **4000** | **PUBLIC** | **REQUIRED**                 | Public HTTPS → container 4000 |
| **auth**        | `services/auth`          | **4001** | Private    | **REQUIRED**                 | Private networking only       |
| **wallet**      | `services/wallet`        | 3002     | Private    | **REQUIRED**                 | Private                       |
| **blockchain**  | `services/blockchain`    | 3003     | Private    | **REQUIRED**                 | Private + Alchemy egress      |
| **connections** | `services/connections`   | 3016     | Private    | **REQUIRED**                 | Private                       |
| **market-data** | `services/market-data`   | 3012     | Private    | **REQUIRED** (web companion) | Private                       |
| payments        | `services/payments`      | 3004     | Private    | **DO NOT RUN**               | Optional later                |
| compliance      | `services/compliance`    | 3005     | Private    | **DO NOT RUN**               | Optional later                |
| notifications   | `services/notifications` | 3006     | Private    | **DO NOT RUN**               | Auth uses SMTP directly       |
| analytics       | `services/analytics`     | 3007     | Private    | **DO NOT RUN**               | Optional later                |
| ai              | `services/ai`            | 3008     | Private    | **DO NOT RUN**               | Optional later                |
| custody         | `services/custody`       | 3009     | Private    | **DO NOT RUN**               | Optional later                |
| observability   | `services/observability` | 3010     | Private    | **DO NOT RUN**               | Optional later                |
| swap            | `services/swap`          | 3013     | Private    | **DO NOT RUN**               | Optional later                |
| nft             | `services/nft`           | 3014     | Private    | **DO NOT RUN** (ABSENT)      | Never for Closed Beta         |
| staking         | `services/staking`       | 3015     | Private    | **DO NOT RUN**               | Optional later                |
| bridge          | `services/bridge`        | 3017     | Private    | **DO NOT RUN**               | Optional later                |

**Do not delete code** for disabled services. Gateway keeps proxy middleware; missing upstreams return controlled **502** (`UPSTREAM_UNAVAILABLE`) / **503** (`UPSTREAM_CIRCUIT_OPEN`). NFT routes return **410** locally (no upstream).

---

## 2. Classification summary

| Class                                |  Count | Services                                                                                                                     |
| ------------------------------------ | -----: | ---------------------------------------------------------------------------------------------------------------------------- |
| **REQUIRED AT LAUNCH**               |  **6** | `gateway`, `auth`, `wallet`, `blockchain`, `connections`, `market-data`                                                      |
| **OPTIONAL / DISABLED (do not run)** | **11** | `payments`, `compliance`, `notifications`, `analytics`, `ai`, `custody`, `observability`, `swap`, `nft`, `staking`, `bridge` |
| **DEV ONLY**                         |      — | Local compose Postgres/Redis/Mailpit; `MAIL_DRIVER=console` (forbidden in prod)                                              |

Supporting managed deps (not Nest processes): **Postgres 16**, **Redis 7**, **Resend SMTP**, **Alchemy** (blockchain only).

---

## 3. Railway topology

```text
                    Internet
                       │
                       ▼
            ┌──────────────────────┐
            │  gateway :4000       │  ← ONLY public Railway service
            │  (api.auvorawallet…) │
            └──────────┬───────────┘
                       │  private networking (*_SERVICE_URL)
     ┌─────────────────┼─────────────────┬──────────────┐
     ▼                 ▼                 ▼              ▼
  auth:4001      wallet:3002     blockchain:3003   connections:3016
                                                     market-data:3012
     │                 │                 │              │
     └─────────────────┴────────┬────────┴──────────────┘
                                ▼
              Railway Postgres 16  +  Railway Redis 7
                                +
                    Resend SMTP  ·  Alchemy RPC
```

| Rule     | Detail                                                                                 |
| -------- | -------------------------------------------------------------------------------------- |
| Public   | **gateway only** — generate public domain / custom domain for API                      |
| Private  | auth, wallet, blockchain, connections, market-data — **no public networking**          |
| Data     | One Postgres plugin (or external) shared via `DATABASE_URL`; one Redis via `REDIS_URL` |
| Replicas | **1 gateway** (in-memory rate limit); 1 each for other required services               |
| Helm     | Not used on Railway for Closed Beta; chart kept for future K8s                         |

---

## 4. Private networking via env vars

Never hardcode Railway `*.railway.internal` hostnames in source. Set at runtime:

| Gateway env               | Closed Beta target pattern                                          |
| ------------------------- | ------------------------------------------------------------------- |
| `AUTH_SERVICE_URL`        | `http://auth.railway.internal:4001` (or Railway reference URL)      |
| `WALLET_SERVICE_URL`      | `http://wallet.railway.internal:3002`                               |
| `BLOCKCHAIN_SERVICE_URL`  | `http://blockchain.railway.internal:3003`                           |
| `CONNECTIONS_SERVICE_URL` | `http://connections.railway.internal:3016`                          |
| `MARKET_DATA_SERVICE_URL` | `http://market-data.railway.internal:3012`                          |
| Other `*_SERVICE_URL`     | Leave defaults or point at unused hosts — routes degrade gracefully |

Prefer **Railway Variable References** / shared variable groups over copy-paste. Local defaults remain `http://127.0.0.1:<port>` in `env.schema.ts`.

---

## 5. Postgres 16

| Item      | Spec                                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Version   | **PostgreSQL 16**                                                                                    |
| Extension | **`citext`** — migration `20260725180000_auth_identity` runs `CREATE EXTENSION IF NOT EXISTS citext` |
| ORM       | Prisma 6.5 · `@auvora/database-schema` · **22** migrations                                           |
| URL       | `DATABASE_URL` — append `sslmode=require` (or Railway TLS params) when required                      |
| Pooling   | `connection_limit` / `pool_timeout` via URL + `applyDatabasePoolEnv` / `withDatabaseUrlPool`         |
| Shared DB | Single logical DB for all Nest services                                                              |
| Migrate   | **Only** `pnpm --filter @auvora/database-schema exec prisma migrate deploy`                          |
| Forbidden | `migrate:dev`, `migrate reset`, `db push --force-reset` on prod                                      |
| Startup   | Bounded Prisma `$connect` retry (8 attempts, exponential backoff, cap 8s)                            |

### Safe first-prod sequence (ops — not run in this pass)

1. Create Railway Postgres 16 (empty)
2. Confirm **citext** allowed
3. Store `DATABASE_URL` in shared secrets group
4. One-off migrate job / CI with network to DB: `prisma migrate status` → `migrate deploy` → status again
5. Automated backups / PITR before inviting testers

---

## 6. Redis 7

| Item     | Spec                                                                         |
| -------- | ---------------------------------------------------------------------------- |
| Version  | **Redis 7**                                                                  |
| URL      | `REDIS_URL` (`redis://` or `rediss://`)                                      |
| Scope    | Private networking only                                                      |
| Auth use | Rate limits (`ratelimit:*`); sessions/refresh live in Postgres               |
| Gateway  | Redis **optional**; rate limit is **in-memory** → keep **1 gateway replica** |
| Client   | ioredis with bounded `retryStrategy` (auth)                                  |

---

## 7. Docker hardening

| Check            | Status                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Base             | `node:22-alpine`                                                       |
| Multi-stage      | `deps` → `build` → `runner`                                            |
| Workspace        | Copies `database/` + Prisma generate (Linux engines)                   |
| Prod deps        | `pnpm install --frozen-lockfile`                                       |
| Non-root         | User `auvora`                                                          |
| Healthcheck      | `wget` → `http://127.0.0.1:${PORT}/health`                             |
| Secrets in image | None — runtime env only                                                |
| Local compose    | Postgres 16 + Redis 7 unchanged; app services remain profile-commented |

**Build example (ops):**

```bash
docker build -f infrastructure/docker/Dockerfile.service \
  --build-arg SERVICE=gateway --build-arg PORT=4000 \
  -t auvora/gateway-service:closed-beta .
```

Repeat for `auth` (4001), `wallet` (3002), `blockchain` (3003), `connections` (3016), `market-data` (3012).

**This workstation:** Docker CLI **absent** → container builds **not executed here**. CI `build-images.yml` remains the verifier.

---

## 8. Health checks

| Probe       | Path                                 | Use on Railway                                                         |
| ----------- | ------------------------------------ | ---------------------------------------------------------------------- |
| Liveness    | `GET /health`                        | Restart policy / healthcheck (always 200 when process up)              |
| Readiness   | `GET /ready`                         | Prefer for deploy traffic; gateway returns **503** if auth unreachable |
| Public safe | Gateway `/health` only on public URL | Do not expose domain-service ports                                     |
| Internal    | Private service `/health` + `/ready` | Railway internal health                                                |

**Note:** Some services historically return HTTP 200 with body `Unhealthy` on `/ready`. Gateway readiness is probe-compatible (non-2xx when auth down). Prefer `/health` for restart loops; use `/ready` for traffic gating where status codes are honored.

---

## 9. Environment inventory

See [`RAILWAY_ENVIRONMENT_MATRIX.md`](./RAILWAY_ENVIRONMENT_MATRIX.md) — **NAMES ONLY**, grouped for Railway shared variables / per-service overrides. Prefer Railway references for `DATABASE_URL`, `REDIS_URL`, `INTERNAL_API_KEY`, JWT/CSRF secrets.

---

## 10. Email (Resend SMTP)

| Role               | Address / var                                | Surface                             |
| ------------------ | -------------------------------------------- | ----------------------------------- |
| Transactional From | `SMTP_FROM=noreply@auvorawallet.com`         | Auth (`MAIL_DRIVER=smtp`)           |
| Display name       | `SMTP_FROM_NAME=Auvora Wallet`               | Auth                                |
| Transport          | `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=587` | Auth                                |
| Credentials        | `SMTP_USER`, `SMTP_PASS`                     | Auth secrets only                   |
| Public support     | `support@auvorawallet.com`                   | Web/mobile UI copy — not SMTP From  |
| Verify/reset links | `APP_PUBLIC_URL=https://auvorawallet.com`    | Auth (web origin, **not** API host) |

Configure SPF/DKIM/DMARC for `auvorawallet.com` before beta invites. Do **not** run `notifications` solely for Closed Beta mail.

---

## 11. Alchemy (server-side only)

| Rule  | Detail                                                                               |
| ----- | ------------------------------------------------------------------------------------ |
| Where | **blockchain** service env only                                                      |
| Names | `ALCHEMY_API_KEY`, `ALCHEMY_*_RPC_URL`, `ALCHEMY_RPC_TIMEOUT_MS`, `ALCHEMY_REQUIRED` |
| Never | `NEXT_PUBLIC_*`, Vercel web, mobile release dart-defines, gateway                    |
| Prod  | `BLOCKCHAIN_PRIMARY_PROVIDER=alchemy`, `BLOCKCHAIN_SIMULATOR_ENABLED=false`          |

---

## 12. Reown

| Surface   | Name                        | Notes                                              |
| --------- | --------------------------- | -------------------------------------------------- |
| Web       | `NEXT_PUBLIC_WC_PROJECT_ID` | Project ID only — public OK                        |
| Mobile    | `WC_PROJECT_ID`             | Same Project ID                                    |
| Secret    | Reown Secret                | Server-only if ever used — never web/mobile public |
| Allowlist | Reown Cloud                 | `https://auvorawallet.com` (+ www if needed)       |

**DEVICE VERIFICATION REQUIRED** for web→Android WalletConnect pair before inviting testers. Broadcast remains OFF — WC cannot bypass kill switch.

---

## 13. Gateway for `api.auvorawallet.com`

| Concern     | Closed Beta setting                                                              |
| ----------- | -------------------------------------------------------------------------------- |
| Process     | gateway `:4000`                                                                  |
| Trust proxy | **1 hop** (Express) — Railway TLS terminate                                      |
| CORS        | `CORS_ORIGINS=https://auvorawallet.com,https://www.auvorawallet.com` — never `*` |
| CSRF        | Enforced in **auth** (double-submit); gateway forwards cookies                   |
| Cookies     | `COOKIE_SECURE=true`, `COOKIE_DOMAIN` empty (host-only on API)                   |
| Rate limit  | `GATEWAY_RATE_LIMIT_*` in-memory; skip `/health`, `/ready`                       |
| Swagger     | Disabled when `NODE_ENV=production`                                              |
| NFT         | Local 410 middleware                                                             |

**DNS not changed in this pass.** When ready: point `api.auvorawallet.com` CNAME/A to Railway public gateway — **not** Vercel.

---

## 14. Vercel → API (document only — do not modify Vercel)

Set on the Vercel project that owns `auvorawallet.com` (Production):

| Name                        | Value                          |
| --------------------------- | ------------------------------ |
| `NEXT_PUBLIC_API_URL`       | `https://api.auvorawallet.com` |
| `NEXT_PUBLIC_APP_URL`       | `https://auvorawallet.com`     |
| `NEXT_PUBLIC_APP_NAME`      | `Auvora Wallet`                |
| `NEXT_PUBLIC_WC_PROJECT_ID` | Reown Project ID only          |

Never on Vercel: `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `CSRF_SECRET`, `INTERNAL_API_KEY`, `ALCHEMY_*`, `SMTP_*`, Reown Secret.

---

## 15. Startup dependencies (bounded retry)

| Dependency    | Behavior                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Postgres      | Prisma `$connect` retries with exponential backoff (8 attempts, max delay 8s), then fail boot  |
| Redis (auth)  | ioredis `retryStrategy` bounded (≤10 attempts, cap 3s); lazy connect; `/ready` reflects health |
| Upstream Nest | Gateway circuits — no crash loop if optional services down                                     |
| Alchemy       | Boot fails in prod if `ALCHEMY_REQUIRED` / primary alchemy and credentials missing             |

---

## 16. Failure isolation

| Dependency down                                 | User-visible effect                                               |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| Postgres                                        | `/health` OK; `/ready` unhealthy; writes fail — no silent success |
| Redis                                           | Rate-limit paths degrade; sessions still Postgres                 |
| Auth down                                       | Gateway `/ready` → 503; auth routes 502/503                       |
| wallet / blockchain / connections / market-data | Proxied routes 502/503; other paths OK                            |
| Optional services not running                   | Expected for Closed Beta                                          |
| SMTP                                            | Register/forgot fail with 5xx — configure before invites          |
| Alchemy                                         | Blockchain RPC errors / degraded providers                        |

Broadcast OFF — fund-moving paths refuse live submission regardless.

---

## 17. Logging

Pino redaction on gateway/auth (and peers): `authorization`, `cookie`, `x-internal-api-key`, `x-csrf-token`, `password` / `currentPassword` / `newPassword`, `token`, refresh/access tokens.  
`LOG_LEVEL=warn` in production. Never log mnemonics, SMTP passwords, Alchemy keys, or full `DATABASE_URL`.

---

## 18. Closed Beta resource plan (Railway)

| Component   | Replicas | CPU (approx)   | RAM (approx)                    |
| ----------- | -------: | -------------- | ------------------------------- |
| gateway     |        1 | 0.2–0.5 vCPU   | 512 MB                          |
| auth        |        1 | 0.2–0.5 vCPU   | 512 MB–1 GB                     |
| wallet      |        1 | 0.2–0.5 vCPU   | 512 MB                          |
| blockchain  |        1 | 0.5 vCPU       | 512 MB–1 GB                     |
| connections |        1 | 0.2–0.5 vCPU   | 512 MB                          |
| market-data |        1 | 0.2–0.5 vCPU   | 512 MB                          |
| Postgres 16 |  managed | provider small | ≥1–2 GB tier · 20–50 GB storage |
| Redis 7     |  managed | micro/small    | ≥256–512 MB                     |

Avoid enabling all 17 services or HPA minReplicas=3 (Helm prod defaults) for Closed Beta.

---

## 19. Exact Railway deployment order

1. **Create Railway project** (ops) — do not use this doc pass to create resources
2. **Provision Postgres 16** → enable/confirm **citext** → store `DATABASE_URL`
3. **Provision Redis 7** → store `REDIS_URL` (private)
4. **Shared secrets group** — JWT, CSRF, `INTERNAL_API_KEY`, SMTP, Alchemy (see env matrix)
5. **One-off migrate** — `prisma migrate deploy` against empty prod DB only
6. **Deploy `auth`** (private) — health `/health`, ready `/ready`
7. **Deploy `wallet`, `blockchain`, `connections`, `market-data`** (private) — any order after migrate; blockchain needs Alchemy
8. **Deploy `gateway`** (public `:4000`) — set all required `*_SERVICE_URL` to private hosts
9. **Smoke** — public `https://<railway-gateway>/health` then `/ready`
10. **DNS** (ops, later) — `api.auvorawallet.com` → Railway gateway
11. **Vercel env** (ops) — `NEXT_PUBLIC_API_URL=https://api.auvorawallet.com`
12. **Auth/mail smoke** — register → noreply verify → login cookies/CSRF
13. **Do not deploy** nft / deferred services

---

## 20. Rollback plan

| Layer               | Action                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Railway service     | Redeploy previous image tag / rollback deployment                                        |
| Migrations          | Forward-only; **never** `migrate reset` after user data — fix-forward with new migration |
| Gateway bad release | Roll gateway alone; domain services keep running                                         |
| Auth incident       | Revoke sessions via auth admin; rotate JWT/CSRF/`INTERNAL_API_KEY`                       |
| Funds risk          | Kill switches already OFF — no broadcast unlock needed for emergency stop                |
| DNS                 | Keep prior target until smoke passes; change TTL-aware                                   |
| Vercel              | Instant previous deployment restore for web-only issues                                  |

---

## 21. Local validation (this pass)

| Check                                                              | Result                                                     |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `@auvora/database` jest (pool + Prisma retry)                      | **PASS** (5)                                               |
| `@auvora/security` jest                                            | **PASS** (12)                                              |
| `@auvora/auth-service` targeted jest                               | **PASS** (21)                                              |
| `@auvora/gateway-service` jest                                     | **PASS** (6)                                               |
| Typecheck gateway, auth, wallet, blockchain, connections, database | **PASS**                                                   |
| Docker image build                                                 | **PARTIAL** — Docker CLI absent on workstation             |
| Live `api.auvorawallet.com` /health                                | Out of scope (no deploy); known DNS blocker until retarget |

### Code hardening applied (no deploy)

- Gateway + auth: Express **trust proxy = 1** for Railway edge
- Shared Prisma: **bounded `$connect` retry**
- Auth Redis: **bounded reconnect `retryStrategy`**
- Dockerfile.service already includes `database/` workspace member (prior fix)

---

## 22. Docs delivered

| Doc                                           | Purpose                               |
| --------------------------------------------- | ------------------------------------- |
| `docs/RAILWAY_CLOSED_BETA_DEPLOYMENT_PLAN.md` | This plan (phases 1–22)               |
| `docs/RAILWAY_SERVICE_MATRIX.md`              | Per-service Railway enablement matrix |
| `docs/RAILWAY_ENVIRONMENT_MATRIX.md`          | Variable groups — names only          |

---

## Scorecard (preparation)

| Gate                           | Status                                                  |
| ------------------------------ | ------------------------------------------------------- |
| Backend services               | 17 inventoried                                          |
| Required at launch             | 6                                                       |
| Not required to run            | 11                                                      |
| Railway topology design        | **READY**                                               |
| Docker                         | **PARTIAL** (image contract good; local build unproven) |
| Postgres 16 / citext / Redis 7 | **READY** (app contract; hosts not provisioned)         |
| Private networking             | **READY** (env-driven)                                  |
| Gateway                        | **READY**                                               |
| `api.auvorawallet.com`         | **READY FOR DNS** (ops)                                 |
| Vercel→API config              | **READY** (documented; not applied)                     |
| Env matrix                     | **COMPLETE**                                            |
| Security design                | **PASS**                                                |
| Broadcast                      | **OFF**                                                 |
| Reown web→Android              | **DEVICE VERIFICATION REQUIRED**                        |

**Helm:** retained · **NFT:** ABSENT · **No Railway deploy performed in this pass.**
