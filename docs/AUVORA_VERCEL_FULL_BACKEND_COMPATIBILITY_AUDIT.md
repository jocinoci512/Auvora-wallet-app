# AUVORA — Vercel Full Backend & Ecosystem Compatibility Audit

**Date:** 2026-08-06 · **Catalogued:** 2026-08-11  
**Type:** Architecture decision (read-only audit)  
**Closed Beta decision (current):** HYBRID — keep web on Vercel (`auvorawallet.com`); run Nest mesh on Railway always-on containers. Do **not** host Nest on Vercel Fluid.

**Source of truth:** Nest services under `services/{gateway,auth,wallet,blockchain,connections,market-data}` + Prisma schema + Vercel docs evaluated 2026-07/08.

**Related:** [`AUVORA_SUPABASE_COMPATIBILITY_AUDIT.md`](./AUVORA_SUPABASE_COMPATIBILITY_AUDIT.md) · [`PRODUCTION_BACKEND_INFRASTRUCTURE_REQUIREMENTS.md`](./PRODUCTION_BACKEND_INFRASTRUCTURE_REQUIREMENTS.md) · [`RAILWAY_CLOSED_BETA_DEPLOYMENT_PLAN.md`](./RAILWAY_CLOSED_BETA_DEPLOYMENT_PLAN.md) · [`RAILWAY_SERVICE_MATRIX.md`](./RAILWAY_SERVICE_MATRIX.md) · [`RAILWAY_ENVIRONMENT_MATRIX.md`](./RAILWAY_ENVIRONMENT_MATRIX.md) · [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## Executive verdict

| Question                                                                                                                                                                    | Answer                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can **this** Vercel account/project host **both** web **and** the Closed Beta Nest API mesh **as-is**, without compromising security / reliability for a **crypto wallet**? | **No.**                                                                                                                                                                                              |
| Best Closed Beta posture                                                                                                                                                    | **HYBRID (Option C):** Vercel web (`auvorawallet.com`) + **always-on containers** for Nest mesh (Railway prepared, or Fly/Render/ECS/Cloud Run) + **one** Postgres 16 (+ `citext`) + **one** Redis 7 |
| Pure-Vercel Nest backend (Fluid / Functions / OCI / Services)                                                                                                               | **CONDITIONAL only after rewrite** — not Closed Beta primary                                                                                                                                         |
| Prefer security over convenience?                                                                                                                                           | **Yes → secrets off web project; gateway-only public; keep Nest on private always-on hosts**                                                                                                         |

| Score                                            | Value        |
| ------------------------------------------------ | ------------ |
| Vercel as **sole** Nest mesh host (current code) | **38 / 100** |
| Hybrid (Vercel web + always-on Nest mesh)        | **82 / 100** |
| Railway / always-on containers for Nest mesh     | **8.5 / 10** |
| Vercel for Nest mesh as-is                       | **3.5 / 10** |
| Vercel for web                                   | **8.8 / 10** |

---

## Classification legend (A–E)

| Class | Meaning                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------- |
| **A** | Fits Vercel natively with current code (web / Next)                                                                 |
| **B** | Fits Fluid/Functions with light config; no process-lifetime assumptions                                             |
| **C** | Possible on Vercel only with moderate changes (Redis RL, worker flags/cron rewrite, Nest adapter, secret isolation) |
| **D** | Poor fit without significant rewrite or consolidation; process-lifetime / multi-service mesh assumptions            |
| **E** | Requires always-on containers (or equivalent) for safe Closed Beta                                                  |

---

# Phases 1–23

## Phase 1 — Closed Beta inventory (code truth)

All six required services: NestJS 11 · `nest build` → `node dist/main.js` · `app.listen(PORT)` · `/health` + `/ready` · shared Docker `infrastructure/docker/Dockerfile.service`.

| Service         | Port | Public?    | Persistent deps             | Process-lifetime features                                                                    | Class                                                 |
| --------------- | ---- | ---------- | --------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **gateway**     | 4000 | **PUBLIC** | Optional DB/Redis           | HTTP reverse-proxy mesh; **in-memory** `FixedWindowRateLimiter`; `trust proxy = 1`           | **D** (→ **E** if multi-instance without Redis RL)    |
| **auth**        | 4001 | Private    | **Postgres + Redis + SMTP** | Long-lived Nest; ioredis; cookie/JWT/CSRF; nodemailer SMTP                                   | **D** (→ **C** if consolidated + Redis-backed limits) |
| **wallet**      | 3002 | Private    | Postgres + Redis            | `WALLET_WORKERS_ENABLED` default **true** → multiple `setInterval`                           | **D** / **E** with workers on                         |
| **blockchain**  | 3003 | Private    | Postgres + Redis + Alchemy  | `ProviderHealthMonitor` **always** `setInterval`; sync timer only if simulator on            | **D** / **E**                                         |
| **connections** | 3016 | Private    | Postgres + Redis            | **No Nest WebSocket server**; `CONNECTIONS_WORKERS_ENABLED` default **true** → `setInterval` | **D** / **E** with workers                            |
| **market-data** | 3012 | Private    | Postgres + Redis            | `MARKET_DATA_WORKERS_ENABLED` default **true** → `setInterval`                               | **D** / **E** with workers                            |

**Deferred (do not run):** payments, compliance, notifications, analytics, ai, custody, observability, swap, nft, staking, bridge. NFT already **410** at gateway.

---

## Phase 2 — Current Vercel capabilities (2026 — not legacy assumptions)

### Fluid Compute & Functions

| Fact                        | Detail                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Default                     | Fluid Compute on by default for new projects (since 2025-04-23)                                                                     |
| Model                       | Multi-invocation concurrency on shared instances; Active CPU billing; instances pause when idle                                     |
| Scale-to-one                | Pro/Enterprise production: keep ≥1 warm instance (reduces cold starts; **not** always-on multi-service Docker)                      |
| Max duration Hobby          | **300s** hard max                                                                                                                   |
| Max duration Pro/Enterprise | Default 300s; max **800s** GA; extended **1800s** beta (function-level; Secure Compute/Static IPs do **not** support >800s in beta) |
| Memory                      | Hobby ≤ **2 GB**; Pro/Enterprise ≤ **4 GB**                                                                                         |
| NestJS                      | Official framework support — Nest deploys as a **Vercel Function / Service**, not a Railway-style always-on replica                 |
| Concurrency                 | Auto-scale to **30,000** (Hobby/Pro)                                                                                                |

### Containers / OCI

| Fact                        | Detail                                                                      |
| --------------------------- | --------------------------------------------------------------------------- |
| Support                     | OCI images can run as Vercel Functions                                      |
| Always-on?                  | **No** — still Fluid lifecycle                                              |
| Secure Compute / Static IPs | **Not supported** with custom container images (per Vercel Docker guidance) |
| Fit                         | Packaging Nest in OCI does **not** restore always-on private mesh           |

### Vercel Services (multi-framework)

| Fact        | Detail                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------- |
| Capability  | Multiple services (e.g. Next + Nest) in one project; private bindings; shared domain/rewrites |
| Compute     | Still Fluid Functions — same duration / pause model                                           |
| Implication | Better routing ergonomics; **does not** fix `setInterval` workers or in-memory gateway RL     |

### WebSockets (public beta, June 2026)

| Fact     | Detail                                                                                |
| -------- | ------------------------------------------------------------------------------------- |
| Platform | Native WS on Fluid; connection pinned to instance; inherits **maxDuration**           |
| State    | Must use external store (e.g. Marketplace Redis) — no durable in-memory rooms         |
| Auvora   | **Irrelevant as Closed Beta blocker** — connections service has **no** Nest WS server |

### Cron

| Plan             | Crons / project | Min interval     | Precision  |
| ---------------- | --------------- | ---------------- | ---------- |
| Hobby            | 100             | **Once per day** | ±59 min    |
| Pro / Enterprise | 100             | Once per minute  | Per-minute |

Auvora workers use **20–60s** `setInterval` — **cannot** map honestly to Hobby cron; Pro cron still requires **rewriting** workers to HTTP-triggered jobs.

### Marketplace data

| Capability                                                     | Fit                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| Marketplace Postgres (Neon, Prisma Postgres, Supabase, Aurora) | Viable **if** Postgres **16** + **`citext`**                 |
| Marketplace Redis (Upstash)                                    | Viable for ioredis (`redis://` / `rediss://`)                |
| Env / secrets                                                  | Supported; **never** put mesh secrets on the **web** project |

---

## Phase 3 — gateway deep audit — Class **D**

**Code:** `services/gateway/src/main.ts` — CORS allowlist, security headers, internal-route deny, cookie-parser, proxy middleware to all domain services, local NFT **410**.

**Rate limit:** `FixedWindowRateLimiter` constructed **in-process** (`rate-limit.middleware.ts`). Railway matrix already notes **1 replica** because of this.

| Issue                                                   | Severity                                             |
| ------------------------------------------------------- | ---------------------------------------------------- |
| In-memory RL uneven / bypassable across Fluid instances | **HARD BLOCKER** for multi-instance                  |
| Assumes stable private `*_SERVICE_URL` mesh             | Consolidation or Services bindings required          |
| Nest bootstrap + many proxies → cold-start cost         | Soft / latency                                       |
| Gateway-only public contract                            | Achievable, but domain services must stay non-public |

---

## Phase 4 — auth deep audit — Class **D** (C after consolidation)

**Needs:** Postgres sessions/users (`Prisma*Repository`); Redis rate limits; JWT access/refresh; CSRF double-submit; SMTP via `MAIL_DRIVER=smtp` → `SmtpMailAdapter` (nodemailer).

| Issue                                   | Severity                             |
| --------------------------------------- | ------------------------------------ |
| Long-lived Nest + ioredis pattern       | Soft on Fluid if request-driven only |
| Cookie `Secure` + host-only on API host | OK with dedicated `api.*`            |
| SMTP egress                             | Soft — works if outbound allowed     |
| Secrets co-located with web project     | **HARD** security risk if mis-scoped |
| `MAIL_DRIVER=console`                   | Forbidden in production              |

Sessions live in **Postgres** (good for multi-instance _if_ pooler used).

---

## Phase 5 — wallet deep audit — Class **D** / **E**

**Workers** (`wallet-workers.service.ts`): sync / balance / portfolio / retry / health via `setInterval` when `WALLET_WORKERS_ENABLED=true` (default **true**). Intervals ~20–60s.

**In-memory queue:** `WalletRetryQueue` — process-local array; comment admits Redis-backed queue is future work. Lost on Fluid recycle.

| Issue                                            | Severity                                |
| ------------------------------------------------ | --------------------------------------- |
| `setInterval` dies when instance pauses/recycles | **HARD BLOCKER** for worker semantics   |
| In-memory retry queue                            | **HARD** under multi-instance / recycle |
| Disable workers for request-only beta            | Soft — thinner companion                |

**Non-custodial:** Engine explicitly never accepts/stores private keys or mnemonics; mobile holds keys on-device.

---

## Phase 6 — blockchain deep audit — Class **D** / **E**

**Alchemy:** Server-side JSON-RPC only (`AlchemyEvmProvider`, Solana/Tron/Bitcoin providers). **No** `wss://` / `eth_subscribe` in Alchemy adapters — HTTP RPC.

**Background:**

- `ProviderHealthMonitor` **unconditionally** starts `setInterval` on module init.
- `SyncService` timer only when `BLOCKCHAIN_SIMULATOR_ENABLED=true` (prod must be **false**).

| Issue                                           | Severity                              |
| ----------------------------------------------- | ------------------------------------- |
| Always-on health sweep assumes process lifetime | **HARD BLOCKER** without rewrite      |
| Alchemy keys on web / mobile release            | Security hard rule (host-independent) |

---

## Phase 7 — connections deep audit — Class **D** / **E** (WebSocket myth cleared)

**Truth:** Grep found **zero** `@WebSocketGateway` / Socket.IO / `ws` server in `services/connections`. Paths are HTTP Nest (`walletconnect/sessions`, dApp permissions, devices) + optional workers.

**Workers** (default on): monitor connections/sessions/devices/sync/retries/health — Postgres job rows + Redis heartbeats.

| Issue                  | Severity                      |
| ---------------------- | ----------------------------- |
| Worker timers on Fluid | **HARD BLOCKER** if enabled   |
| Platform WS gap        | **Not a Closed Beta blocker** |

Live Reown relay is **mobile/web client ↔ Reown Cloud**, not Nest WebSocket.

---

## Phase 8 — market-data deep audit — Class **D** / **E**

**Workers** (default on): price / metadata / portfolio / cache / history / alert via `setInterval`. Primary provider CoinGecko (or simulator when flagged — prod must pin simulator **false**).

Same Fluid timer conflict as wallet/connections.

---

## Phase 9 — Background work inventory (Bull / Schedule / timers)

| Mechanism                      | Present in Closed Beta six?                                    |
| ------------------------------ | -------------------------------------------------------------- |
| Bull / BullMQ / `@nestjs/bull` | **No** matches in services                                     |
| `@nestjs/schedule` / `@Cron`   | **No**                                                         |
| `setInterval` workers          | **Yes** — wallet, connections, market-data, blockchain health  |
| In-memory queues               | **Yes** — `WalletRetryQueue`                                   |
| Redis-backed jobs              | Partial — connections retry rows in Postgres; auth RL in Redis |

**Verdict:** Background work is **process-timer based**, not durable queue based → hostile to Fluid pause/recycle without rewrite.

---

## Phase 10 — Consolidation analysis + risk

| Approach                               | Pros                              | Cons (wallet company)                                                              |
| -------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| Keep 6 services on Fluid/Services      | Matches topology                  | 6 cold starts; workers broken; private mesh awkward                                |
| Consolidate → one Nest Function        | One deploy unit; simpler bindings | Large refactor; bigger blast radius; still need worker→cron/queue; loses isolation |
| Gateway-only on Vercel → external mesh | Minimal Nest change on Vercel     | Not “full backend on Vercel”; gateway RL still wrong for multi-instance            |

**Consolidation risk:** **HIGH** — multi-week rewrite + auth/cookie/proxy regression risk. **Not** a Closed Beta shortcut.

**Can consolidate?** Technically yes later. **Should for Closed Beta?** **No.**

---

## Phase 11 — Option A / B / C domain architecture

```text
Option A — Single Vercel project (web + Nest mesh)
  REJECT for Closed Beta: secret bleed risk + workers unfit + RL unfit

Option B — Two Vercel projects (web | API)
  CONDITIONAL research only: cleaner secrets, SAME Fluid limits

Option C — HYBRID (RECOMMENDED)
  Vercel: auvorawallet.com (apps/web)
  Always-on containers: api.auvorawallet.com → gateway:4000 → private Nest
  One Postgres 16 + citext · One Redis 7
```

| Option | Verdict                                      |
| ------ | -------------------------------------------- |
| **A**  | Reject Closed Beta                           |
| **B**  | Conditional spike only — still not always-on |
| **C**  | **RECOMMENDED**                              |

---

## Phase 12 — Mobile same API (Android / iOS)

| Client         | API posture                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| **Web**        | `NEXT_PUBLIC_API_URL` → `https://api.auvorawallet.com` (gateway)                                        |
| **Android**    | Self-custody vault on-device; companion features should use **same** public gateway base URL when wired |
| **iOS**        | Same contract when shipped — one account / one API host                                                 |
| Hosting choice | Transparent if gateway contract + CORS/cookies hold                                                     |

Mobile does **not** require Nest for local vault operations. Reown Project ID via dart-define / `NEXT_PUBLIC_WC_PROJECT_ID`; **never** Reown Secret or production Alchemy in release APKs.

**ONE-ACCOUNT ECOSYSTEM:** Yes — shared auth cookies/JWT via same API host; web companion + mobile vault; same user identity in Postgres.

---

## Phase 13 — ONE Postgres + ONE Redis (Vercel-compatible picks)

| Store                                       | Recommendation                                                                                                                                                             | Why                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Postgres**                                | **ONE** DB (`auvora_wallet`), Postgres **16**, extension **`citext`** required (`User.email` / `username` `@db.Citext`; migration `CREATE EXTENSION IF NOT EXISTS citext`) | Single Prisma schema; all Closed Beta services share it                                         |
| **Best managed PG for Vercel adjacency**    | **Neon** (Marketplace) **or** Railway/RDS Postgres 16 — verify `citext`                                                                                                    | Prefer Neon if mesh ever coexists with Vercel tooling; Railway PG fine if mesh stays on Railway |
| **Redis**                                   | **ONE** Redis **7**-compatible instance                                                                                                                                    | Auth RL, caches, worker heartbeats                                                              |
| **Best managed Redis for Vercel adjacency** | **Upstash Redis** (Marketplace) **or** Railway Redis 7                                                                                                                     | ioredis URL; TLS `rediss://` if required                                                        |

**Do not** put `DATABASE_URL` / `REDIS_URL` on the Vercel **web** project.

---

## Phase 14 — Auth cookies / CORS

| Setting         | Closed Beta recommendation                                        |
| --------------- | ----------------------------------------------------------------- |
| API host        | `https://api.auvorawallet.com` → gateway only                     |
| Web             | `https://auvorawallet.com` (+ www)                                |
| `COOKIE_DOMAIN` | **Empty** (host-only on API) — per `cookie.helper.ts`             |
| `COOKIE_SECURE` | `true`                                                            |
| SameSite        | `lax`                                                             |
| CORS            | Explicit allowlist (`APP_PUBLIC_URL` + `CORS_ORIGINS`); never `*` |

Same-origin rewrite (`auvorawallet.com/api` → Nest) mixes attack surfaces — **not preferred** for wallet security.

---

## Phase 15 — Resend: SMTP vs HTTPS API (recommend only)

| Path                                                              | Code status         | Recommendation                      |
| ----------------------------------------------------------------- | ------------------- | ----------------------------------- |
| `MAIL_DRIVER=smtp` + nodemailer → Resend SMTP (`smtp.resend.com`) | **Implemented**     | **Use for Closed Beta**             |
| Resend HTTPS REST API                                             | **Not implemented** | Optional future — do not block beta |
| `MAIL_DRIVER=console`                                             | Dev only            | Forbidden in production             |

---

## Phase 16 — Alchemy / Reown / market-data / wallet non-custodial

| Surface             | Rule                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Alchemy             | **blockchain service only** — never Vercel web `NEXT_PUBLIC_*`; never production key in mobile release dart-defines |
| Reown               | Project ID public OK; **Secret** never public / never APK                                                           |
| Wallet Nest service | Companion metadata/engine — **not** custodial key store for mobile vault                                            |
| Market-data         | Pricing/portfolio — no secrets in browser                                                                           |
| Broadcast           | Remains **OFF** — hosting must not unlock fund movement                                                             |

---

## Phase 17 — Connections WebSocket truth

| Claim                                         | Reality                                                     |
| --------------------------------------------- | ----------------------------------------------------------- |
| “Connections needs persistent Nest WebSocket” | **FALSE** for current code                                  |
| Nest WS / Socket.IO in connections            | **None found**                                              |
| What exists                                   | HTTP session/proposal APIs + optional `setInterval` workers |
| Realtime WC                                   | Client ↔ Reown Cloud relay (mobile/web), not Nest           |

**PERSISTENT WEBSOCKET REQUIRED (Nest):** **No** for Closed Beta.

---

## Phase 18 — Security + env matrix (NAMES ONLY)

### Never on Vercel web

`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`, `INTERNAL_API_KEY`, `ALCHEMY_*`, `SMTP_*`, Reown **Secret**, field encryption keys, object-storage keys.

### Vercel web (allowed)

`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_WC_PROJECT_ID`, optional `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_DOCS_URL`, `NEXT_PUBLIC_STATUS_URL`, `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_CDN_ASSET_BASE_URL`.

### Gateway (public API process)

`PORT`, `CORS_ORIGINS`, `AUTH_SERVICE_URL`, `WALLET_SERVICE_URL`, `BLOCKCHAIN_SERVICE_URL`, `CONNECTIONS_SERVICE_URL`, `MARKET_DATA_SERVICE_URL`, optional other `*_SERVICE_URL`, `GATEWAY_RATE_LIMIT_*`, `PROXY_TIMEOUT_MS`, `INTERNAL_API_KEY`, `NODE_ENV`, `LOG_LEVEL`.

### Auth (private)

`DATABASE_URL`, `REDIS_URL`, `JWT_*`, `CSRF_SECRET`, `COOKIE_SECURE`, `COOKIE_DOMAIN`, `APP_PUBLIC_URL`, `CORS_ORIGINS`, `MAIL_DRIVER`, `SMTP_*`, `AUTH_ALLOW_UNVERIFIED_LOGIN`, `INTERNAL_API_KEY`, lockout/rate-limit names.

### wallet / blockchain / connections / market-data (private)

Shared: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `CSRF_SECRET`, `INTERNAL_API_KEY`, worker/simulator flags.  
Blockchain extras: `ALCHEMY_*`, `BLOCKCHAIN_PRIMARY_PROVIDER`, `BLOCKCHAIN_SIMULATOR_ENABLED`.

Full tables: [`RAILWAY_ENVIRONMENT_MATRIX.md`](./RAILWAY_ENVIRONMENT_MATRIX.md).

**Security posture:** Prefer HYBRID. Gateway-only public. Alchemy/JWT/CSRF/SMTP/DB/Redis off marketing web project.

---

## Phase 19 — Vercel Hobby limits (HARD / SOFT / SCALING)

| Item                                                                       | Class                                                             | Notes                                                             |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| Always-on Nest multi-service mesh on Fluid/OCI                             | **HARD BLOCKER**                                                  | Pause/recycle ≠ designed runtime                                  |
| `setInterval` workers (wallet/connections/market-data + blockchain health) | **HARD BLOCKER**                                                  | Not durable across Fluid lifecycle                                |
| Gateway in-memory RL under multi-instance Fluid                            | **HARD BLOCKER**                                                  | Uneven enforcement                                                |
| Postgres without `citext`                                                  | **HARD BLOCKER**                                                  | Auth identity                                                     |
| Hobby cron vs 20–60s workers                                               | **HARD BLOCKER**                                                  | Daily-only cron                                                   |
| Hobby maxDuration 300s                                                     | **SOFT** for HTTP APIs; **HARD** for long-lived WS if added later |
| Nest cold start / monorepo bundle ≤250MB (Large Functions beta 5GB)        | **SOFT LIMIT**                                                    | Latency / size risk                                               |
| Pro scale-to-one                                                           | **SOFT mitigation**                                               | Warm instance ≠ multi-service always-on + private mesh            |
| Connection pooling fan-out                                                 | **SCALING CONCERN**                                               | Use pooler; one DB                                                |
| Gateway 1-replica RL                                                       | **SCALING CONCERN**                                               | Move RL to Redis before HPA                                       |
| Secure Compute unavailable for OCI                                         | **SOFT / SCALING**                                                | Weaker private DB peering for containerized Functions             |
| Hobby Active CPU / memory quotas                                           | **SCALING CONCERN**                                               | Closed Beta mesh may exhaust Hobby; Pro likely required if spiked |

---

## Phase 20 — Railway vs Vercel scores (1–10)

| Dimension                                | Railway / always-on containers | Vercel as Nest mesh host | Vercel as web |
| ---------------------------------------- | -----------------------------: | -----------------------: | ------------: |
| Fit to current Nest code                 |                              9 |                        3 |           n/a |
| Private multi-service networking         |                              9 |                        5 |           n/a |
| Worker / setInterval honesty             |                              9 |                        2 |           n/a |
| Security isolation (gateway-only public) |                              9 |                        5 |             8 |
| Perf predictability                      |                              8 |                        4 |             9 |
| Scalability path                         |                              7 |                        6 |             9 |
| Maintainability (no rewrite)             |                              9 |                        3 |             9 |
| Observability defaults                   |                              6 |                        8 |             9 |
| Ops friction (trial/card)                |             User-blocked today |            Lower for web |  Already live |
| **Weighted mesh score**                  |                        **8.5** |                  **3.5** |   **8.8 web** |

Railway trial limits are **commercial/ops**, not architecture invalidation. Same always-on shape on Fly/Render/ECS/Cloud Run is valid if Railway remains blocked.

---

## Phase 21 — Migration impact (keep Railway as rollback)

| Keep                                                          | Change only if ever moving mesh → Vercel             |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| Railway (or equivalent) as **rollback** until soak passes     | Worker → cron/queue rewrite                          |
| One DB / one Redis (careful host move; never `migrate reset`) | Redis-backed gateway RL                              |
| Gateway public contract                                       | Possibly consolidate services                        |
| Broadcast OFF                                                 | DNS cutover TTL-aware                                |
| Helm chart for future K8s                                     | Separate spike project — never prod-first experiment |

**Do not delete Railway.** Do not migrate for Closed Beta solely to unify billing with Vercel.

---

## Phase 22 — Implementation plan (document only — DO NOT EXECUTE)

### Phase 0 — Decision lock

Confirm **Option C hybrid**. Keep Railway prepared as rollback (or provision equivalent always-on host if trial remains blocked).

### Phase 1 — Data

Provision Postgres 16 + `citext` + Redis 7. Secrets in platform secret store only.

### Phase 2 — Migrate

One-off `prisma migrate deploy` on empty prod DB only (ops-owned).

### Phase 3 — Private services

Deploy auth → wallet / blockchain / connections / market-data (private). Pin simulators **false**. Decide worker flags for beta load.

### Phase 4 — Public gateway

Deploy gateway public; set `*_SERVICE_URL`; smoke `/health` `/ready`.

### Phase 5 — DNS (ops later)

Point `api.auvorawallet.com` at gateway. Set Vercel `NEXT_PUBLIC_API_URL`.

### Phase 6 — Auth/mail smoke

Register → Resend SMTP verify → login cookies/CSRF.

### Phase 7 — Mobile

Same API URL; Reown device verification.

### Explicit non-goals

No Nest→serverless rewrite · No NFT enable · No broadcast unlock · No deleting Railway · No Vercel prod backend as primary without separate spike.

---

## Phase 23 — Final scorecard + architecture decision

### Architecture decision record

```text
RECOMMENDED (Closed Beta / security-first):

  [Vercel] auvorawallet.com  (apps/web)
           │
           │  NEXT_PUBLIC_API_URL
           ▼
  [Always-on containers] api.auvorawallet.com → gateway:4000
           │
           ├── auth:4001
           ├── wallet:3002
           ├── blockchain:3003
           ├── connections:3016
           └── market-data:3012
           │
           ├── managed Postgres 16 + citext
           └── managed Redis 7
           +
           Resend SMTP (auth) · Alchemy (blockchain only)

REJECTED as primary: full Nest mesh on Vercel Fluid/OCI/Services without rewrite.
CONDITIONAL later: Vercel Nest spike only after Redis RL + worker redesign + secret isolation.
```

### Gate summary

| Gate                                  | Status                                                        |
| ------------------------------------- | ------------------------------------------------------------- |
| Web on Vercel                         | **FIT (A)**                                                   |
| Nest mesh on Vercel as-is             | **NOT FIT (D/E)**                                             |
| Hybrid web + containers               | **FIT — RECOMMENDED**                                         |
| Connections Nest WebSocket blocker    | **FALSE**                                                     |
| Background workers on Fluid           | **HARD BLOCKER**                                              |
| Gateway in-memory RL on Fluid         | **HARD BLOCKER** (multi-instance)                             |
| citext / PG16                         | **HARD requirement**                                          |
| SMTP path                             | **Ready** (Resend SMTP)                                       |
| Prisma                                | Compatible with one shared PG; pool carefully on serverless   |
| Live broadcast                        | **OFF** — keep off                                            |
| Vercel Closed Beta ready (backend)    | **No** as sole host                                           |
| Vercel production potential (backend) | **Conditional** after rewrite — not preferred for wallet mesh |
| Railway still required                | **Yes** (or equivalent always-on) as Nest host / rollback     |
| Security preference                   | **Hybrid wins**                                               |

### Validation status

| Check                                                                                             | Status                             |
| ------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Code audit (mains, env schemas, workers, WS grep, Prisma citext, SMTP adapter, Alchemy HTTP-only) | **Done**                           |
| Current Vercel docs (Fluid, WS, cron, containers, Services, Marketplace, Hobby limits)            | **Done**                           |
| Full `pnpm` test/build suite                                                                      | **Not re-run** — do not claim PASS |
| Live deploy / DNS / Railway / Vercel prod changes                                                 | **Not performed** (forbidden)      |

---

## Parent agent return block

```text
AUVORA VERCEL ECOSYSTEM AUDIT

WEB ON VERCEL: YES (FIT — Class A; auvorawallet.com already)
BACKEND ON VERCEL: NO as-is (Nest mesh Class D/E; Fluid ≠ always-on private multi-service)
ANDROID → VERCEL API: NO — Android → same public gateway (api.*) on always-on host; Vercel is web only in recommended hybrid
IOS → VERCEL API: NO — same as Android when shipped; one API host, not Vercel Nest
ONE-ACCOUNT ECOSYSTEM: YES — shared auth via same API host + Postgres identity
GATEWAY: Class D (in-memory RL → E under multi-instance Fluid); keep public-only on containers
AUTH: Class D (C if consolidated); Postgres+Redis+SMTP; host-only Secure cookies
WALLET: Class D/E — setInterval workers + in-memory retry queue; non-custodial companion
BLOCKCHAIN: Class D/E — ProviderHealthMonitor always on; Alchemy HTTP RPC server-side only
CONNECTIONS: Class D/E with workers — NO Nest WebSocket; HTTP + timers
MARKET-DATA: Class D/E — setInterval workers; CoinGecko; pin simulators false
POSTGRES: ONE shared PG16 + citext required
REDIS: ONE shared Redis 7–compatible
PRISMA: YES — single schema/migrations; use pooler if ever serverless
ALCHEMY: blockchain service only — never web NEXT_PUBLIC / never prod in APK
REOWN: Project ID public OK; Secret never public; relay is client↔Reown not Nest WS
RESEND: Use SMTP (implemented); HTTPS API optional later
PERSISTENT WEBSOCKET REQUIRED: NO (for Nest Closed Beta)
ALWAYS-ON WORKER REQUIRED: YES if worker flags default-on; disable or rewrite for Fluid
CAN CONSOLIDATE BACKEND: YES later — NOT for Closed Beta
CONSOLIDATION RISK: HIGH
SECURITY: Prefer hybrid; secrets off Vercel web; gateway-only public
LIVE BROADCAST: OFF — keep off
VERCEL CLOSED BETA READY: NO for Nest mesh primary
VERCEL PRODUCTION POTENTIAL: CONDITIONAL after major rewrite — not preferred for wallet
RAILWAY STILL REQUIRED: YES (or equivalent always-on containers) as Nest host + rollback
BEST DATABASE: ONE Postgres 16 + citext — Neon Marketplace or Railway/RDS PG16
BEST REDIS: ONE Redis 7 — Upstash Marketplace or Railway Redis 7
BEST API ARCHITECTURE: Public gateway → private Nest mesh → one PG + one Redis
BEST DOMAIN ARCHITECTURE: Option C — auvorawallet.com on Vercel; api.auvorawallet.com on always-on gateway
RAILWAY SCORE: 8.5 / 10 (Nest mesh)
VERCEL SCORE: 3.5 / 10 (Nest mesh) · 8.8 / 10 (web)
FINAL RECOMMENDATION: HYBRID — keep web on Vercel; run Closed Beta Nest mesh on always-on containers (Railway prepared or equivalent); do not put Nest primary on Vercel Fluid
WHY: Current code assumes long-lived processes (setInterval workers, in-memory gateway RL, private multi-service mesh); Fluid pause/duration/Hobby cron cannot honor that safely for a crypto wallet without high-risk rewrite
NEXT ACTION: Unlock always-on Nest host (finish Railway trial/billing OR provision Fly/Render/ECS equivalent); provision one PG16+citext + one Redis; deploy 6 Closed Beta services privately + public gateway; point api.auvorawallet.com; keep Railway as rollback — no Vercel Nest migration for Closed Beta
```

---

## Document control

| Field                      | Value                                                          |
| -------------------------- | -------------------------------------------------------------- |
| Created / completed        | 2026-08-06                                                     |
| Catalogued                 | 2026-08-11                                                     |
| Closed Beta follow-through | Vercel web + Railway Nest mesh; Nest-on-Fluid **out of scope** |
