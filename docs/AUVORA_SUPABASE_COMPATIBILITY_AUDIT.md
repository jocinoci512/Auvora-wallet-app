# AUVORA — COMPLETE SUPABASE COMPATIBILITY & ARCHITECTURE AUDIT

**Date:** 2026-08-06 · **Catalogued:** 2026-08-11  
**Type:** Architecture decision (read-only audit)  
**Closed Beta decision (current):** HYBRID — Vercel web + Railway Nest mesh + existing Railway Postgres/Redis. Supabase is **optional Postgres only**, never Nest Auth/Edge replacement.

**Source of truth:** Nest services under `services/{gateway,auth,wallet,blockchain,connections,market-data}` + Prisma schema + Railway/Vercel docs + Supabase docs evaluated 2026-08.

**Related:** [`AUVORA_VERCEL_FULL_BACKEND_COMPATIBILITY_AUDIT.md`](./AUVORA_VERCEL_FULL_BACKEND_COMPATIBILITY_AUDIT.md) · [`PRODUCTION_BACKEND_INFRASTRUCTURE_REQUIREMENTS.md`](./PRODUCTION_BACKEND_INFRASTRUCTURE_REQUIREMENTS.md) · [`RAILWAY_CLOSED_BETA_DEPLOYMENT_PLAN.md`](./RAILWAY_CLOSED_BETA_DEPLOYMENT_PLAN.md) · [`RAILWAY_SERVICE_MATRIX.md`](./RAILWAY_SERVICE_MATRIX.md) · [`RAILWAY_ENVIRONMENT_MATRIX.md`](./RAILWAY_ENVIRONMENT_MATRIX.md)

**Crypto wallet posture:** Security over convenience · private keys / seeds **never** server-side · `service_role` **never** in client · gateway-only public · broadcast remains **OFF**.

---

## Executive verdict

| Question                                                                                                            | Answer                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Can Supabase **alone** host the Closed Beta Nest mesh **as-is** (replace always-on containers)?                     | **No.**                                                                                                                                                            |
| Can Supabase **minimize** always-on surface (replace managed Postgres; optional Auth/Realtime later)?               | **Yes — Postgres (Pro+) is a strong fit; Nest mesh still needs always-on host + Redis.**                                                                           |
| Does Nest auth cookies/CSRF/`INTERNAL_API_KEY` mesh + Alchemy + Redis sessions map cleanly to Supabase Auth + Edge? | **No — HIGH-risk rewrite.** Prefer **KEEP Nest auth** + optional HYBRID later.                                                                                     |
| Best Closed Beta posture                                                                                            | **Option C (HYBRID):** Vercel web + always-on Nest mesh (Railway/Fly/Render/…) + **Supabase Postgres (Pro, not Free)** _or_ Railway/Neon PG + **external Redis 7** |
| Prefer security over convenience?                                                                                   | **Yes → secrets off web; service_role never in browser/APK; do not expose Prisma tables via anon PostgREST without hardened RLS.**                                 |

| Score                                                               | Value                                      |
| ------------------------------------------------------------------- | ------------------------------------------ |
| Supabase as **sole** Nest mesh host (current code)                  | **28 / 100**                               |
| Supabase as **managed Postgres only** for Nest mesh                 | **84 / 100**                               |
| Hybrid (Vercel web + always-on Nest + Supabase PG + external Redis) | **86 / 100**                               |
| Full rewrite → Supabase Auth + Edge + PostgREST (eliminate Nest)    | **22 / 100** (Closed Beta)                 |
| Railway / always-on containers for Nest mesh                        | **8.5 / 10** (unchanged from Vercel audit) |
| Supabase for Nest mesh as-is                                        | **2.5 / 10**                               |
| Supabase for Postgres (Pro)                                         | **8.6 / 10**                               |

---

## Classification legend

| Class         | Meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| **KEEP**      | Retain Nest service / pattern on always-on host                |
| **REDUCE**    | Keep service but shrink workers / move cache / thin role       |
| **REPLACE**   | Candidate for Supabase product (PG/Auth/Edge/Realtime/Storage) |
| **MUST KEEP** | Cannot drop without breaking Closed Beta contract              |
| **A–E** (fit) | Same as Vercel audit: A native fit → E requires always-on      |

---

# Phases 1–22

## Phase 1 — Closed Beta inventory (code truth)

All six required services: NestJS 11 · `nest build` → `node dist/main.js` · `app.listen(PORT)` · `/health` + `/ready` · shared Docker `infrastructure/docker/Dockerfile.service`.

| Service         | Port | Public?    | Persistent deps             | Process-lifetime features                                                                                               | Supabase fit                                                       |
| --------------- | ---- | ---------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **gateway**     | 4000 | **PUBLIC** | Optional DB/Redis           | HTTP reverse-proxy mesh; **in-memory** `FixedWindowRateLimiter`; strips `x-internal-api-key` on proxy                   | **MUST KEEP** (always-on) — Edge cannot host Nest proxy mesh as-is |
| **auth**        | 4001 | Private    | **Postgres + Redis + SMTP** | Custom JWT access/refresh; CSRF double-submit; sessions/refresh in **Postgres**; Redis rate limits                      | **KEEP** Nest auth — Supabase Auth = HIGH rewrite                  |
| **wallet**      | 3002 | Private    | Postgres + Redis            | `WALLET_WORKERS_ENABLED` default **true** → `setInterval` 20–60s; in-memory `WalletRetryQueue`; non-custodial companion | **KEEP** — Cron/Queues only after rewrite                          |
| **blockchain**  | 3003 | Private    | Postgres + Redis + Alchemy  | `ProviderHealthMonitor` **always** `setInterval`; Alchemy **HTTP** JSON-RPC server-side                                 | **KEEP** — secrets must stay in Nest secrets                       |
| **connections** | 3016 | Private    | Postgres + Redis            | **No Nest WebSocket**; workers default **true** → Redis heartbeats                                                      | **KEEP** — Realtime optional later, not required                   |
| **market-data** | 3012 | Private    | Postgres + Redis            | Workers default **true** → price/metadata cache in Redis                                                                | **KEEP** — Redis cache not Supabase Realtime                       |

**Deferred (do not run):** payments, compliance, notifications, analytics, ai, custody, observability, swap, nft, staking, bridge. NFT already **410** at gateway.

**Prior Vercel audit conclusion (still valid):** Nest mesh needs **always-on** containers; Fluid/Edge pause ≠ designed runtime.

---

## Phase 2 — Current Supabase capabilities (2026 — verified, not invented)

### Postgres

| Fact                     | Detail                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product                  | Dedicated Postgres per project                                                                                                                                                   |
| Majors (platform images) | **15** and **17** (and OrioleDB-17 experimental) per supabase/postgres — **not** marketing “PG16-only”                                                                           |
| Auvora docs require      | Compose/Helm specify **Postgres 16** + **`citext`**                                                                                                                              |
| Practical mapping        | Use Supabase **PG15 or PG17**; confirm `CREATE EXTENSION citext` before `prisma migrate deploy`. Prisma does **not** hard-require 16 — docs’ “16” is ops convention from compose |
| Extensions               | 50+ preconfigured; `pg_cron`, `pgmq` (Queues), wrappers; enable via Dashboard/SQL                                                                                                |
| `citext`                 | Standard contrib; enable with `CREATE EXTENSION IF NOT EXISTS citext` (Auvora migration already does this). **Ops gate:** verify on target major before migrate                  |
| Pooling                  | Direct `:5432` · Supavisor session `:5432` · Supavisor transaction `:6543` · Dedicated PgBouncer transaction `:6543` (paid)                                                      |
| Prisma note              | Transaction pooler needs `pgbouncer=true` (disable prepared statements). Prefer **session/direct** for long-lived Nest; transaction mode for Edge/serverless only                |

### Auth (GoTrue)

| Fact                    | Detail                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capabilities            | Email/password, OAuth, MFA, custom SMTP, JWT sessions, SSR cookie helpers (`@supabase/ssr`)                                                         |
| Security traps (skill)  | Never authorize from user-editable `user_metadata`; prefer `app_metadata`; deleting user ≠ instant token invalidation; service_role never in client |
| Fit to Auvora Nest auth | **Poor as drop-in** — different session model, no CSRF double-submit matching Nest, no `INTERNAL_API_KEY` mesh, different user/permission tables    |

### RLS / PostgREST / RPC

| Fact           | Detail                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Data API       | PostgREST auto-API on exposed schemas; RLS **required** on public tables if exposed                 |
| Nest today     | Prisma via **privileged** `DATABASE_URL` (bypasses RLS) — correct for private mesh                  |
| Risk           | Enabling Data API + anon key against Auvora tables **without** strict RLS = wallet-company incident |
| Recommendation | Keep Nest as sole DB client for Closed Beta; **do not** expose product tables via anon PostgREST    |

### Realtime

| Fact        | Detail                                                                        |
| ----------- | ----------------------------------------------------------------------------- |
| Free        | 200 peak connections · 2M messages/mo · 256 KB max message                    |
| Pro         | 500 peak included · 5M messages · 3 MB max                                    |
| Auvora need | **None for Nest Closed Beta** — no Nest WS; Reown relay is client↔Reown Cloud |

### Storage

| Fact   | Detail                                                                   |
| ------ | ------------------------------------------------------------------------ |
| Free   | 1 GB · 50 MB max upload                                                  |
| Pro    | 100 GB included                                                          |
| Auvora | No Closed Beta Nest dependency on object storage; avatars optional later |

### Edge Functions (Deno)

| Fact          | Detail                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| Runtime       | Deno isolate — **not** Node NestJS                                                                     |
| Memory        | **256 MB**                                                                                             |
| Wall clock    | Free **150s** · Paid **400s**                                                                          |
| CPU time      | **2s** per request                                                                                     |
| Idle timeout  | 150s                                                                                                   |
| Bundle        | 20 MB local CLI / 5 MB server-side                                                                     |
| Secrets       | ≤100 secrets/project; ≤48 KiB each; no `SUPABASE_` prefix                                              |
| Egress blocks | Outbound ports **25** and **587** blocked — **SMTP from Edge fails**; use HTTPS mail APIs or Nest SMTP |
| Nest fit      | **Cannot run** current Nest services on Edge without full rewrite                                      |

### Cron (`pg_cron` / Supabase Cron)

| Fact           | Detail                                                                         |
| -------------- | ------------------------------------------------------------------------------ |
| Schedule       | Cron syntax — docs: from **every second** to yearly                            |
| Actions        | SQL / DB functions / HTTP (e.g. invoke Edge Function)                          |
| Guidance       | ≤8 concurrent jobs; each job ≤10 minutes                                       |
| Auvora workers | 20–60s `setInterval` **could** map to Cron→HTTP **after rewrite**; not drop-in |

### Queues (`pgmq`)

| Fact    | Detail                                                                         |
| ------- | ------------------------------------------------------------------------------ |
| Product | Postgres-native durable queues (pgmq)                                          |
| Fit     | Future replacement for in-memory `WalletRetryQueue` — **rewrite**, not plug-in |

### Secrets

| Fact         | Detail                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Edge secrets | Dashboard/CLI secrets for Functions                                                             |
| Vault        | For FDW credentials etc.                                                                        |
| Nest mesh    | Still needs platform secret store on **always-on host** for JWT/CSRF/Alchemy/`INTERNAL_API_KEY` |

### Redis

| Fact                              | Detail                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| Native managed Redis on Supabase? | **No**                                                                                 |
| Official pattern                  | **Upstash Redis** (REST/ioredis) for Edge rate limits; Redis FDW wrapper for SQL reads |
| Auvora                            | Still needs **ONE Redis 7–compatible** instance (Upstash / Railway Redis / etc.)       |

### Free plan (pricing page 2026-08)

| Item                 | Free                                 |
| -------------------- | ------------------------------------ |
| DB                   | 500 MB · Shared CPU · **500 MB RAM** |
| Pause                | After **1 week inactivity**          |
| Backups              | **Not included**                     |
| MAU                  | 50,000                               |
| Egress               | 5 GB (+ 5 GB cached)                 |
| Edge invocations     | 500,000                              |
| Active free projects | 2                                    |

---

## Phase 3 — Redis use classification (critical)

Supabase does **not** eliminate Redis for Auvora.

| Service         | Redis role                                                                       | Replaceable by Supabase?                       | Class                                      |
| --------------- | -------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| **gateway**     | Optional noop adapter; RL is **in-memory**                                       | N/A — move RL to Redis for multi-replica later | KEEP Redis optional; **fix RL separately** |
| **auth**        | **Required** — `ratelimit:*` (login/mail); `denylist:*` helpers; readiness probe | **No** (Queues/Cron ≠ atomic incr rate limit)  | **KEEP Redis**                             |
| **wallet**      | Required — readiness; rate limiter port; workers don’t heavily cache             | Partial future: Queues for retry               | **KEEP Redis**                             |
| **blockchain**  | Required — rate limit; simulator ledger keys; **pub/sub** event bus (`publish`)  | Realtime ≠ drop-in for Redis pub/sub consumers | **KEEP Redis**                             |
| **connections** | Required — worker heartbeats (`connections:worker:*`); rate limit                | Cron heartbeats possible later                 | **KEEP Redis**                             |
| **market-data** | Required — price/metadata cache (`md:price:*`, `md:trending`)                    | Postgres cache tables possible but slower      | **KEEP Redis** (best)                      |

**Bull / BullMQ / `@nestjs/schedule`:** **Absent** in Closed Beta six (confirmed). Background work = **`setInterval`** + in-memory retry queue.

**Verdict:** Even with perfect Supabase Postgres, Closed Beta still needs **external Redis**. Supabase alone does **not** remove always-on Redis dependency.

---

## Phase 4 — Auth deep audit: KEEP vs Supabase Auth vs HYBRID

### Current Nest auth (code)

| Concern      | Implementation                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Sessions     | Postgres `Session` via Prisma — revokeable; JWT validates live session                                        |
| Tokens       | Access + refresh JWTs (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`)                                            |
| CSRF         | Double-submit cookie + header (`CSRF_SECRET`, `CsrfGuard`)                                                    |
| Cookies      | Host-only preferred (`COOKIE_DOMAIN` empty); `Secure`; `SameSite=lax`; refresh/access httpOnly; CSRF readable |
| Mail         | `MAIL_DRIVER=smtp` → nodemailer (Resend SMTP) — **not** Edge-compatible (ports 25/587 blocked on Edge)        |
| Rate limits  | Redis `ratelimit:*`                                                                                           |
| Mesh         | Downstream services trust Nest JWT + `INTERNAL_API_KEY` for internal routes                                   |
| Admin / RBAC | Permission codes, roles in Prisma — custom                                                                    |

### Scoring (Closed Beta / wallet security)

| Option                                                                     | Fit                         | Security                                       | Effort                                                                       | Score /10 | Verdict                       |
| -------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- | --------: | ----------------------------- |
| **KEEP Nest auth**                                                         | Matches mesh                | Proven CSRF + session revoke                   | None                                                                         |   **9.0** | **RECOMMENDED**               |
| **REPLACE → Supabase Auth**                                                | Breaks cookie/CSRF/JWT mesh | Different threat model; RLS/JWT claim pitfalls | **HIGH** multi-week rewrite of auth + all JWT consumers + web/mobile clients |   **3.0** | **REJECT for Closed Beta**    |
| **HYBRID** (Nest identity primary; Supabase Auth for optional OAuth later) | Possible long-term          | Must not dual-source authorization             | Medium–HIGH                                                                  |   **5.5** | **Defer** — not beta shortcut |

**Honest call:** Nest auth cookies/CSRF/`INTERNAL_API_KEY` mesh **do not map cleanly** to Supabase Auth + Edge without HIGH risk rewrite. Prefer **KEEP**.

---

## Phase 5 — Gateway: MUST KEEP / REDUCE / REMOVE

| Action               | Assessment                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **MUST KEEP**        | Public reverse proxy, CORS allowlist, security headers, internal-route deny, NFT 410, cookie passthrough, circuit-aware upstreams |
| **REDUCE**           | Later: Redis-backed RL (today in-memory → 1 replica); optional consolidation of proxy table                                       |
| **REMOVE**           | **Do not** replace with PostgREST-only public API for Closed Beta                                                                 |
| **Edge as gateway?** | **No** — Nest middleware mesh + long-lived proxy + cookie credentials; Edge memory/CPU/duration unfit; rewrite required           |

**Class:** **MUST KEEP** on always-on host (same as Vercel audit Class D/E).

---

## Phase 6 — Per-service KEEP / REDUCE / REPLACE

| Service         | Decision                                               | Why                                                                        |
| --------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| **gateway**     | **MUST KEEP**                                          | Public contract; in-memory RL; Nest proxy                                  |
| **auth**        | **KEEP**                                               | Custom JWT/CSRF/sessions/SMTP; Supabase Auth ≠ drop-in                     |
| **wallet**      | **KEEP** (+ optional **REDUCE** workers for thin beta) | Non-custodial companion; `setInterval` + in-memory retry; never store keys |
| **blockchain**  | **KEEP**                                               | Alchemy server-side only; health monitor timers                            |
| **connections** | **KEEP**                                               | HTTP WC/device APIs; workers optional                                      |
| **market-data** | **KEEP**                                               | Redis cache + workers; CoinGecko                                           |

**REPLACE candidates (infra only, not Nest processes):**

| Infra            | Candidate                                                               |
| ---------------- | ----------------------------------------------------------------------- |
| Managed Postgres | **REPLACE** Railway/Neon PG with **Supabase Postgres (Pro)** if desired |
| Redis            | **KEEP external** (Upstash/Railway) — not Supabase-native               |
| Object storage   | Optional **REPLACE** later with Supabase Storage                        |
| Auth             | **Do not REPLACE** for Closed Beta                                      |

---

## Phase 7 — Edge Functions suitability

| Workload                                                              | Edge suitable?         | Notes                                                                              |
| --------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| Nest gateway / auth / wallet / blockchain / connections / market-data | **No**                 | Deno ≠ Nest; 256 MB; 2s CPU; no process timers                                     |
| Thin HTTP job triggered by Cron (future)                              | **Conditional**        | After extracting job handlers; Alchemy keys as Edge secrets OK **if** never client |
| SMTP mail                                                             | **No**                 | Ports 25/587 blocked                                                               |
| Full auth CSRF mesh                                                   | **No** without rewrite |                                                                                    |

**Verdict:** Edge does **not** eliminate always-on Nest for Closed Beta.

---

## Phase 8 — Realtime & Storage

| Product      | Closed Beta need                                      | Recommendation                                          |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------- |
| **Realtime** | **None** for Nest (no WS server; Reown owns WC relay) | Leave off / unused                                      |
| **Storage**  | **None** required for Nest Closed Beta                | Optional later for avatars/docs — RLS buckets carefully |

---

## Phase 9 — RLS risks (wallet company)

| Risk                                                                   | Severity     | Mitigation                                                    |
| ---------------------------------------------------------------------- | ------------ | ------------------------------------------------------------- |
| Exposing Prisma `public` tables via PostgREST + `anon` key without RLS | **CRITICAL** | Do not expose; Nest-only DB access                            |
| Using `user_metadata` in policies                                      | **HIGH**     | Skill: use `app_metadata` only if ever adopting Supabase Auth |
| Views bypassing RLS                                                    | **HIGH**     | `security_invoker` / revoke anon                              |
| `service_role` in Next `NEXT_PUBLIC_*` or mobile                       | **CRITICAL** | Never                                                         |
| Dual clients (Nest Prisma + client supabase-js) fighting policies      | **HIGH**     | Single writer path for beta                                   |

**Closed Beta:** Treat Supabase as **private Postgres** (connection string to Nest only). Disable or ignore Data API for product schemas.

---

## Phase 10 — Mobile + web same project

| Client           | Identity / API                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Web (Vercel)     | `NEXT_PUBLIC_API_URL` → `https://api.auvorawallet.com` (gateway)                              |
| Android / iOS    | Same public gateway when companion features wired; vault keys **on-device**                   |
| Supabase project | **One** Postgres (and optional Auth later) shared — **not** a second identity system for beta |
| ONE-ACCOUNT      | Yes via Nest auth + shared Postgres — **not** via dual Nest+Supabase Auth                     |

---

## Phase 11 — Key classification (ANON vs SERVICE_ROLE)

| Key                       | Where allowed                                                                               | Where forbidden                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **anon / publishable**    | Browser / mobile **only if** RLS-hardened client features exist (not Closed Beta Nest path) | Never used to call Alchemy or bypass Nest                       |
| **service_role / secret** | Server-only (Nest host secrets, Edge secrets, CI)                                           | **Never** web `NEXT_PUBLIC_*`, APK dart-defines, client bundles |
| Nest secrets              | Always-on host secret store                                                                 | Vercel web project                                              |

**Auvora Closed Beta:** Prefer **zero** Supabase client keys in web/mobile until a deliberate RLS product surface exists. Nest uses `DATABASE_URL` only.

---

## Phase 12 — Free plan HARD / SOFT / SCALING

| Item                                                          | Class                                                     | Notes                                   |
| ------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------- |
| Free project **pause after 1 week inactivity**                | **HARD BLOCKER** for Closed Beta API DB                   | Wallet companion cannot vanish          |
| Free **no automatic backups**                                 | **HARD BLOCKER** for production identity DB               | Pro has 7-day backups                   |
| Free **500 MB DB + 500 MB RAM** shared with platform services | **HARD** for 6 Nest services + Prisma                     | Fan-out will thrash                     |
| Free Edge 150s / 500k invocations                             | **SOFT** if Edge unused                                   | Irrelevant if Nest stays                |
| Free Realtime 200 connections                                 | **SOFT** if unused                                        |                                         |
| Pro never-pause + backups                                     | **Required minimum** if using Supabase PG for Closed Beta |                                         |
| Compute Micro 1 GB / 60 direct / 200 pooler                   | **SCALING** — size up if 5 Prisma pools connect           | Use pool params + Supavisor carefully   |
| PG major 15/17 vs docs “16”                                   | **SOFT / OPS GATE**                                       | Verify citext + migrate on chosen major |

**Verdict:** Supabase **Free is unsuitable** as Closed Beta production database. **Pro (or higher)** required if choosing Supabase PG.

---

## Phase 13 — What Supabase can / cannot replace

### Can replace (well)

| Component                                                | Notes                             |
| -------------------------------------------------------- | --------------------------------- |
| Managed **Postgres** (+ citext, backups on Pro, pooling) | Strong Nest `DATABASE_URL` target |
| Optional future Storage / Realtime / Queues / Cron       | After intentional rewrite         |
| Optional future Edge for **isolated** HTTP jobs          | Not Nest                          |

### Cannot replace (without HIGH rewrite)

| Component                                                | Notes                          |
| -------------------------------------------------------- | ------------------------------ |
| Nest **gateway** public mesh                             | MUST KEEP always-on            |
| Nest **auth** JWT/CSRF/session/RBAC                      | KEEP                           |
| Nest **wallet / blockchain / connections / market-data** | KEEP                           |
| **Redis 7** workloads                                    | External Redis required        |
| Alchemy server-side RPC host                             | Nest blockchain                |
| Resend **SMTP** via Edge                                 | Blocked ports — keep Nest SMTP |
| Always-on `setInterval` workers                          | Cron/Queues rewrite only       |

### Still always-on after adopting Supabase PG

```text
ALWAYS-ON REMAINING:
  gateway, auth, wallet, blockchain, connections, market-data
  + external Redis 7
  (+ SMTP egress from auth, Alchemy egress from blockchain)

SUPABASE (managed, not Nest runtime):
  Postgres (Pro+)  [optional host choice]
  (Auth/Edge/Realtime/Storage unused or deferred)
```

**Supabase does not eliminate the always-on Nest host.** It can eliminate **Railway/Neon Postgres** as the DB vendor only.

---

## Phase 14 — Options A–D (scored)

```text
Option A — Full Supabase backend
  Replace Nest with Auth + PostgREST + Edge + Realtime
  Score: 22/100 · REJECT Closed Beta · HIGH rewrite · security regression risk

Option B — Supabase everything except “a little Nest”
  Auth→Supabase, workers→Cron/Edge, keep thin Nest gateway
  Score: 35/100 · Still HIGH auth/mesh rewrite · REJECT as primary

Option C — HYBRID (RECOMMENDED)
  Vercel web · always-on Nest mesh · Supabase Postgres (Pro) OR equivalent PG
  · external Redis 7 · Nest auth KEEP · Edge/Auth unused for beta
  Score: 86/100

Option D — Status quo containers (Railway/Fly/Render PG+Redis) + Vercel web
  No Supabase required
  Score: 84/100 · Equally valid; Railway prepared as rollback
```

| Option | Closed Beta | Security | Rewrite           | Verdict                             |
| ------ | ----------- | -------- | ----------------- | ----------------------------------- |
| **A**  | Fail        | Risky    | Extreme           | Reject                              |
| **B**  | Fail        | Risky    | High              | Reject                              |
| **C**  | Pass        | Strong   | Low (DB URL swap) | **Recommended if wanting Supabase** |
| **D**  | Pass        | Strong   | None              | **Recommended if Railway unlocked** |

---

## Phase 15 — Domain / data architecture (Option C)

```text
RECOMMENDED (Closed Beta / security-first):

  [Vercel] auvorawallet.com  (apps/web)
           │
           │  NEXT_PUBLIC_API_URL
           ▼
  [Always-on containers] api.auvorawallet.com → gateway:4000
           │
           ├── auth:4001          (KEEP Nest auth)
           ├── wallet:3002
           ├── blockchain:3003    (Alchemy secrets here)
           ├── connections:3016
           └── market-data:3012
           │
           ├── [Supabase Pro] Postgres 15/17 + citext   ← optional PG vendor
           │     OR Railway/Neon Postgres 16+citext
           └── [External] Redis 7 (Upstash / Railway / …)
           +
           Resend SMTP (auth Nest) · Alchemy (blockchain Nest)

  Supabase Auth / Edge / Realtime / Storage: DEFER
  PostgREST anon exposure of product tables: OFF
  service_role: Nest/CI only
  Broadcast: OFF
```

---

## Phase 16 — Auth cookies / CORS (unchanged recommendation)

| Setting               | Closed Beta                                          |
| --------------------- | ---------------------------------------------------- |
| API host              | `https://api.auvorawallet.com` → gateway only        |
| Web                   | `https://auvorawallet.com`                           |
| Cookies               | Host-only on API; `COOKIE_SECURE=true`; SameSite=lax |
| CORS                  | Explicit allowlist; never `*`                        |
| Supabase Auth cookies | **Do not introduce** parallel cookie jar for beta    |

---

## Phase 17 — Alchemy / Reown / non-custodial

| Surface     | Rule                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Alchemy     | **blockchain Nest only** — never web `NEXT_PUBLIC_*`; never prod key in APK; never Edge unless Edge is private and replaces Nest (not recommended now) |
| Reown       | Project ID public OK; Secret never public                                                                                                              |
| Wallet Nest | Companion metadata — `exportPolicy: public_metadata_only`; mobile holds keys                                                                           |
| Broadcast   | **OFF**                                                                                                                                                |

---

## Phase 18 — Env / secrets matrix (NAMES ONLY)

### Never on Vercel web / never in client

`DATABASE_URL`, `REDIS_URL`, `JWT_*`, `CSRF_SECRET`, `INTERNAL_API_KEY`, `ALCHEMY_*`, `SMTP_*`, Reown Secret, Supabase **service_role**, field encryption keys.

### Supabase project (if used as PG)

| Name                                               | Consumer                                           |
| -------------------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL` (session/direct preferred for Nest) | auth, wallet, blockchain, connections, market-data |
| Optional `DIRECT_URL`                              | Prisma migrate                                     |
| anon / service_role                                | **Not required** for Nest-only Closed Beta         |

### Always-on Nest (same as Railway matrix)

See [`RAILWAY_ENVIRONMENT_MATRIX.md`](./RAILWAY_ENVIRONMENT_MATRIX.md) — gateway public + private domain services.

---

## Phase 19 — Migration risk (if choosing Supabase PG)

| Risk                                                        | Level      | Notes                                                                                  |
| ----------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `prisma migrate deploy` on empty Supabase DB                | **Medium** | Confirm citext + PG major first                                                        |
| Prisma ↔ Supabase managed schemas (`auth`, `storage`) drift | **Medium** | Do **not** let Prisma manage Supabase `auth` schema; keep Nest tables in `public` only |
| Connection fan-out (5 services × Prisma pools)              | **Medium** | Tune `connection_limit`; prefer Pro compute; Supavisor session mode if IPv4-only       |
| Dual Auth systems                                           | **HIGH**   | Do not enable Supabase Auth alongside Nest for beta                                    |
| Data API exposure                                           | **HIGH**   | Keep locked down                                                                       |
| Cutting over from Railway PG                                | **Medium** | Dump/restore or fresh migrate; keep Railway as rollback                                |
| Worker → Cron/pgmq rewrite                                  | **HIGH**   | Separate project — not required for PG swap                                            |

**Do not** `migrate reset` on any shared prod DB.

---

## Phase 20 — Railway as rollback

| Keep                                     | Why                           |
| ---------------------------------------- | ----------------------------- |
| Railway (or Fly/Render) Nest deploy plan | Always-on mesh still required |
| Railway Postgres as rollback             | If Supabase PG cutover fails  |
| Railway Redis / Upstash                  | Redis remains mandatory       |
| Helm chart                               | Future K8s; unchanged         |

**Do not delete Railway** because Supabase exists. Supabase is a **database (and optional BaaS) vendor**, not a Nest host.

---

## Phase 21 — Implementation plan (DOCUMENT ONLY — DO NOT EXECUTE)

### Phase 0 — Decision lock

Choose **Option C** (or **D** if staying on Railway PG). Explicitly reject Option A/B for Closed Beta. KEEP Nest auth.

### Phase 1 — If Supabase PG

Create **Pro** org/project (not Free). Pick PG **15 or 17**. Enable `citext`. Store `DATABASE_URL` in Nest host secrets only. Confirm backups on.

### Phase 2 — Redis

Provision **external** Redis 7 (Upstash or Railway). Point all Nest `REDIS_URL`.

### Phase 3 — Migrate

Ops-owned: `prisma migrate status` → `migrate deploy` on empty DB. Never reset.

### Phase 4 — Nest mesh

Deploy six Closed Beta services always-on; gateway public; simulators **false**.

### Phase 5 — DNS (ops later)

`api.auvorawallet.com` → gateway. Vercel `NEXT_PUBLIC_API_URL`.

### Phase 6 — Smoke

Register → SMTP verify → login cookies/CSRF → wallet/blockchain health → Redis RL.

### Explicit non-goals

No Nest→Edge rewrite · No Supabase Auth cutover · No PostgREST anon exposure · No broadcast · No Railway delete · No Free-plan production DB.

---

## Phase 22 — Final scorecard + architecture decision

### Gate summary

| Gate                                   | Status                                    |
| -------------------------------------- | ----------------------------------------- |
| Web on Vercel                          | **FIT**                                   |
| Nest mesh on Supabase Edge             | **NOT FIT**                               |
| Nest mesh on always-on + Supabase PG   | **FIT (HYBRID)**                          |
| Replace Redis with Supabase            | **NOT FIT**                               |
| Replace Nest auth with Supabase Auth   | **NOT FIT for Closed Beta**               |
| citext                                 | **Supported path** (verify on PG 15/17)   |
| Free plan for Closed Beta DB           | **HARD FAIL**                             |
| Realtime required                      | **No**                                    |
| Persistent Nest WebSocket              | **No**                                    |
| Always-on workers                      | **Yes** if flags default-on               |
| Live broadcast                         | **OFF**                                   |
| Railway still required (or equivalent) | **Yes** for Nest (+ Redis unless Upstash) |
| Security preference                    | **Hybrid wins; KEEP Nest auth**           |

### Validation status

| Check                                                                                  | Status                        |
| -------------------------------------------------------------------------------------- | ----------------------------- |
| Code audit (Redis, workers, WS grep, CSRF/JWT, INTERNAL_API_KEY, citext, Alchemy HTTP) | **Done**                      |
| Current Supabase docs (pricing, Edge limits, Cron, Queues, pooling, Auth skill traps)  | **Done**                      |
| Full `pnpm` test/build                                                                 | **Not re-run**                |
| Live Supabase project / migrate / deploy                                               | **Not performed** (forbidden) |

---

## Parent agent return block

```text
AUVORA SUPABASE AUDIT

SUPABASE AS SOLE NEST HOST: NO (Edge/Deno ≠ Nest; no always-on multi-service mesh)
SUPABASE AS POSTGRES ONLY: YES (Pro+; verify citext on PG 15/17; Free HARD FAIL)
ANDROID / IOS API: same public gateway on always-on host — not Supabase Edge
ONE-ACCOUNT ECOSYSTEM: YES via Nest auth + shared Postgres — do not dual-run Supabase Auth for beta
GATEWAY: MUST KEEP always-on — in-memory RL; Nest proxy mesh; Edge unfit
AUTH: KEEP Nest (JWT/CSRF/Postgres sessions/Redis RL/SMTP) — Supabase Auth REPLACE = HIGH risk / score 3/10
AUTH HYBRID: DEFER — optional later OAuth only; not Closed Beta shortcut
WALLET: KEEP — setInterval workers + in-memory retry; non-custodial; Queues/Cron only after rewrite
BLOCKCHAIN: KEEP — ProviderHealthMonitor timers; Alchemy HTTP server-side only
CONNECTIONS: KEEP — no Nest WebSocket; workers + Redis heartbeats
MARKET-DATA: KEEP — Redis price cache + workers
REDIS: STILL REQUIRED (external Upstash/Railway) — Supabase has no managed Redis product
POSTGRES: ONE shared DB + citext — Supabase Pro OR Railway/Neon; Nest Prisma via DATABASE_URL
PRISMA: YES — prefer session/direct pool for Nest; pgbouncer=true only on transaction pooler
EDGE FUNCTIONS: unfit for Nest mesh; SMTP ports 25/587 blocked; max 256MB / 2s CPU
REALTIME: NOT REQUIRED for Closed Beta Nest
STORAGE: NOT REQUIRED for Closed Beta Nest
RLS / POSTGREST: do NOT expose product tables via anon — Nest-only DB access
KEYS: service_role NEVER in client; Closed Beta prefers zero Supabase client keys
FREE PLAN: HARD BLOCKERS (pause, no backups, 500MB/500MB RAM)
ALWAYS-ON REMAINING: gateway + auth + wallet + blockchain + connections + market-data + Redis
CAN ELIMINATE ALWAYS-ON: NO without HIGH-risk full rewrite (Option A/B)
OPTION A (full Supabase): 22/100 REJECT
OPTION B (Supabase-heavy + thin Nest): 35/100 REJECT
OPTION C (HYBRID Nest + Supabase PG): 86/100 RECOMMENDED if wanting Supabase
OPTION D (Railway/Fly PG+Redis status quo): 84/100 equally valid
MIGRATION RISK (PG swap only): MEDIUM — citext/major/pool; Auth cutover HIGH
RAILWAY AS ROLLBACK: YES — keep prepared; do not delete
ALCHEMY: blockchain Nest only
REOWN: Project ID OK; Secret never public; relay client↔Reown
RESEND: Nest SMTP KEEP (Edge SMTP blocked)
PERSISTENT WEBSOCKET REQUIRED: NO (Nest)
ALWAYS-ON WORKER REQUIRED: YES if worker flags default-on
SECURITY: Prefer HYBRID; KEEP Nest auth; secrets off Vercel web; no service_role client
LIVE BROADCAST: OFF — keep off
SUPABASE CLOSED BETA READY: YES as Postgres vendor (Pro) · NO as Nest/Edge primary
SUPABASE PRODUCTION POTENTIAL (mesh): CONDITIONAL only after major rewrite — not preferred
BEST API ARCHITECTURE: Public gateway → private Nest mesh → one PG + one Redis
BEST DOMAIN ARCHITECTURE: auvorawallet.com on Vercel; api.* on always-on gateway
SUPABASE MESH SCORE: 2.5/10 · SUPABASE PG SCORE: 8.6/10 · HYBRID SCORE: 86/100
FINAL RECOMMENDATION: HYBRID Option C — keep Nest mesh always-on; KEEP Nest auth; use Supabase Pro Postgres optionally; keep external Redis; do not attempt Auth+Edge replacement for Closed Beta
WHY: Current code assumes long-lived Nest processes, Redis rate limits/caches/pub-sub, custom JWT/CSRF/INTERNAL_API_KEY mesh, and Alchemy SMTP egress — none map cleanly to Supabase Auth + Edge without HIGH risk rewrite; Supabase Free cannot host production identity DB
NEXT ACTION: Unlock always-on Nest host (Railway or Fly/Render); provision ONE Pro Postgres (Supabase or Railway/Neon) with citext + ONE Redis 7; deploy six services; point api.auvorawallet.com; keep Railway as rollback — no Supabase Auth/Edge migration for Closed Beta
```

---

## Document control

| Field                      | Value                                                                            |
| -------------------------- | -------------------------------------------------------------------------------- |
| Created / completed        | 2026-08-06                                                                       |
| Catalogued                 | 2026-08-11                                                                       |
| Closed Beta follow-through | Railway Nest mesh + existing Postgres/Redis; Supabase Auth/Edge **out of scope** |
