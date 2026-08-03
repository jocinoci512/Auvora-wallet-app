# Deployment Checklist — Production / Closed Beta

**Updated:** 2026-08-03 (canonical domain cutover audit)  
**Canonical web:** `https://auvorawallet.com`  
**API (repo contract):** `https://api.auvorawallet.com`  
**Broadcast:** keep OFF · **NFT workers:** OFF in prod example

---

## Architecture classification (do not invent a second stack)

| Surface                                                                | Host class                                       | Evidence                                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **Web** (`apps/web`)                                                   | **VERCEL**                                       | Live `Server: Vercel` on apex; `apps/web/vercel.json` (Next, monorepo install/build, www→apex redirect) |
| **Admin / Docs**                                                       | **VERCEL** (optional)                            | `apps/admin/vercel.json`, `apps/docs/vercel.json`                                                       |
| **Gateway + Nest services** (auth, wallet, blockchain, connections, …) | **EXTERNAL HOST** (Helm/K8s or Docker host)      | `DEPLOYMENT.md` + `infrastructure/helm` — **not** Vercel serverless                                     |
| **Postgres**                                                           | **DB HOST** (managed, external to cluster chart) | Helm `postgres.enabled: false`; `DATABASE_URL` from secrets                                             |
| **Redis**                                                              | **REDIS HOST** (managed)                         | Helm `redis.enabled: false`; `REDIS_URL` from secrets                                                   |

**ONE recommended path (already in repo):** Vercel for Next frontends · GHCR images + Helm (`values-production.yaml`) for gateway/services · managed Postgres + Redis · DNS `api.auvorawallet.com` → gateway ingress.

---

## Cutover audit snapshot (2026-08-03)

| Check                                          | Result                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Apex `https://auvorawallet.com`                | **LIVE** — Auvora web on Vercel (HTTP 200)                                                                       |
| `www` → apex 301                               | **FAIL** — www returns 200, stays on www (redirect in `vercel.json` not effective on live)                       |
| `https://api.auvorawallet.com`                 | **BLOCKED** — DNS on Vercel-like IPs; `/health` and `/api/*` → 404 (not Nest gateway)                            |
| Vercel MCP team (`car-dealerships-projects-…`) | **0 projects** — live site is on a **different** Vercel account/team than MCP                                    |
| Local web typecheck / tests / `next build`     | **PASS**                                                                                                         |
| Domain string drift in ReleaseConfig           | **FIXED in workspace** → `auvorawallet.com` + `support@auvorawallet.com` (redeploy + store listing still needed) |
| Migrations                                     | **22** Prisma migrations present — **do not deploy** until prod `DATABASE_URL` confirmed                         |
| Play signing / AAB                             | **Out of scope** this pass                                                                                       |

---

## Pre-flight (config)

- [ ] Secrets loaded from vault / Vercel / ExternalSecrets — never commit `.env`
- [ ] `NODE_ENV=production`
- [ ] `COOKIE_SECURE=true`
- [ ] `COOKIE_DOMAIN` empty (host-only on API) unless deliberate cross-subdomain
- [ ] `APP_PUBLIC_URL=https://auvorawallet.com` (not localhost)
- [ ] `CORS_ORIGINS` includes apex + www only (no `*`)
- [ ] `MAIL_DRIVER=smtp` with host/port/from (Resend SMTP OK); `SMTP_FROM=noreply@auvorawallet.com`
- [ ] Public support address: `support@auvorawallet.com` (do not expose `admin@` in UI)
- [ ] `AUTH_ALLOW_UNVERIFIED_LOGIN=false`
- [ ] All `*_SIMULATOR_ENABLED=false`
- [ ] `NFT_WORKERS_ENABLED=false`
- [ ] `ALCHEMY_API_KEY` server-side only (blockchain service / Helm secret — never `NEXT_PUBLIC_*` / release APK)
- [ ] JWT / CSRF / INTERNAL_API_KEY rotated ≥32 chars
- [x] Mobile/web About + legal URLs aligned to **auvorawallet.com** in source (await redeploy / store update)

---

## Exact Vercel env var NAMES (`apps/web`)

### PUBLIC (safe to expose / `NEXT_PUBLIC_*`)

| Name                             | Prod value (non-secret)                     |
| -------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_API_URL`            | `https://api.auvorawallet.com`              |
| `NEXT_PUBLIC_APP_URL`            | `https://auvorawallet.com`                  |
| `NEXT_PUBLIC_APP_NAME`           | `Auvora Wallet`                             |
| `NEXT_PUBLIC_ADMIN_URL`          | `https://admin.auvorawallet.com` (optional) |
| `NEXT_PUBLIC_DOCS_URL`           | `https://docs.auvorawallet.com` (optional)  |
| `NEXT_PUBLIC_STATUS_URL`         | `https://auvorawallet.com/status`           |
| `NEXT_PUBLIC_MARKETING_URL`      | `https://auvorawallet.com`                  |
| `NEXT_PUBLIC_CDN_ASSET_BASE_URL` | `https://cdn.auvorawallet.com` (optional)   |
| `NEXT_PUBLIC_WC_PROJECT_ID`      | Reown **Project ID only** (public OK)       |

### SERVER ONLY — never on Vercel web / never `NEXT_PUBLIC_*`

`DATABASE_URL`, `REDIS_URL`, `JWT_*`, `CSRF_SECRET`, `INTERNAL_API_KEY`, `ALCHEMY_API_KEY`, `ALCHEMY_*_RPC_URL`, `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, object-storage keys, field encryption keys, Reown **Secret**.

Auth/mail/gateway vars (`APP_PUBLIC_URL`, `CORS_ORIGINS`, `COOKIE_*`, `MAIL_DRIVER`, …) belong on the **API host**, not necessarily on Vercel.

---

## DNS / TLS

- [x] Apex `auvorawallet.com` → Vercel (observed)
- [ ] `www` → **301** apex (`apps/web/vercel.json` present; **live FAIL** — fix in Vercel domain settings or redeploy project that owns the domain)
- [ ] `api.auvorawallet.com` → **gateway ingress** (today points at Vercel 404 — must retarget)
- [ ] Optional: `admin` / `docs` / `cdn` hosts
- [x] TLS on apex (Vercel)
- [ ] SPF / DKIM / DMARC for `noreply@auvorawallet.com` / `support@`

---

## Backend (Helm / K8s)

- [x] `infrastructure/helm/auvora-wallet/values-production.yaml` hosts = `*.auvorawallet.com`
- [ ] Image tags pinned; cluster + `KUBE_CONFIG_DATA` (or chosen Docker host) available
- [ ] Postgres + Redis healthy; connection pooling set (**BLOCKED** until provisioned)
- [ ] `prisma migrate deploy` on **confirmed** prod DB only (22 migrations ready in repo)
- [ ] Gateway proxies reach auth/wallet/blockchain/…
- [x] Swagger `/api/docs` gated when `NODE_ENV=production` (code)
- [ ] OTEL endpoint reachable if `OTEL_ENABLED=true`

---

## Web (Vercel)

- [ ] Project linked on the **account that owns** `auvorawallet.com` (MCP team currently empty — EXTERNAL)
- [ ] Env: `NEXT_PUBLIC_*` inventory above; public WC project id only
- [x] No `NEXT_PUBLIC_ALCHEMY_*` in repo
- [ ] Preview vs Production env separation
- [ ] Smoke after www redirect + API mesh: marketing home, auth verify/reset, feature badges
- [ ] Reown Cloud allowlist: `https://auvorawallet.com` (+ www if needed)

---

## Auth / mail smoke (requires live API)

- [ ] Register → verification email from **noreply@**
- [ ] Verify link uses `APP_PUBLIC_URL=https://auvorawallet.com`
- [ ] Login + refresh cookie + CSRF on mutating routes
- [ ] Forgot / reset password email
- [ ] Register conflict returns generic message (anti-enum)

---

## Mobile release path

- [ ] Release AAB signed with upload keystore (**next milestone**)
- [ ] No secret dart-defines (Alchemy/JWT/SMTP)
- [ ] Kill switches remain false
- [ ] Deep links / App Links for `auvorawallet.com` (+ Digital Asset Links)
- [ ] **DEVICE VERIFICATION REQUIRED** before inviting testers

---

## Real blockers (current)

| Blocker                                                   | Severity                   |
| --------------------------------------------------------- | -------------------------- |
| `api.auvorawallet.com` not serving Nest gateway           | **Critical**               |
| Managed Postgres + Redis for prod not attested            | **Critical**               |
| www → apex redirect not live                              | High                       |
| Vercel project ownership / env access from this workspace | High                       |
| Auth/SMTP/cookie mesh unverified on deployed prod         | High                       |
| Physical Reown web→Android pair                           | High — DEVICE VERIFICATION |
| Android upload keystore / Play Console                    | High (next milestone)      |

---

## Rollback

- [ ] Keep previous Helm revision / Vercel deployment ready
- [ ] Kill switches remain compile-time OFF — emergency “stop funds” is already default
- [ ] Revoke sessions via auth admin if credential incident

---

## Related

- [`.env.production.example`](../.env.production.example)
- [`DEPLOYMENT.md`](../DEPLOYMENT.md)
- [`docs/FINAL_PRODUCTION_READINESS_REPORT.md`](./FINAL_PRODUCTION_READINESS_REPORT.md)
