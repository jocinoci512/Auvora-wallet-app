# AUVORA RAILWAY FINAL VERIFICATION

**Date:** 2026-08-08 (America/Los_Angeles local session started 2026-08-07)  
**Workspace used:** `D:\auvora-wallet` (confirmed; preferred path exists)  
**Scope:** Independent re-verification of Railway remaining services: **blockchain**, **connections**, **market-data**  
**Rule:** Source code wins over docs. Secret **values** never recorded. Live Railway / external RPCs: **NOT VERIFIED** unless stated.  
**Code fixes this pass:** **None** (turbo build + unit tests + typecheck succeeded; no build/boot blockers found).

---

## Discrepancies vs prior audit (corrections)

| Prior claim                                                          | Re-verified finding                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `/`, Railpack                                                   | **Partially correct / NOT repo-pinned.** No `railway.toml` / Railpack config in repo. Root monorepo is the intended build context. `infrastructure/docker/Dockerfile.service` is the **verified** Docker path. Railpack vs Dockerfile is an **ops choice**, not encoded in git. |
| Start `node services/<svc>/dist/main.js`                             | **Correct for monorepo-root Railpack-style.** Docker image CMD is `node dist/main.js` after copying `services/<svc>/dist` → `/app/dist`.                                                                                                                                        |
| blockchain `INTERNAL_API_KEY` required                               | **Correction:** optional for **boot** (`z.string().min(32).optional()`). Required for **internal** routes (`InternalApiKeyGuard` rejects if unset).                                                                                                                             |
| market-data providers imply CoinCap/Alchemy                          | **Correction:** **server** = CoinGecko + simulator only. CoinGecko → CoinCap → Alchemy Prices → seeded is **mobile client** (`apps/mobile`).                                                                                                                                    |
| Env matrix: connections/market-data `INTERNAL_API_KEY` “recommended” | **Correction:** both schemas require `INTERNAL_API_KEY` min 32 — **REQUIRED to boot**.                                                                                                                                                                                          |
| Env matrix omits field encryption keys                               | **Correction:** `CONNECTIONS_FIELD_ENCRYPTION_KEY` and `MARKET_DATA_FIELD_ENCRYPTION_KEY` are **REQUIRED** (≥32).                                                                                                                                                               |
| Simulators “safe if set false”                                       | **Nuance:** blockchain **hard-fails** production if simulator true. connections / market-data **default true** and do **not** hard-fail in production — ops must pin `false` or service boots in simulator mode.                                                                |
| Broadcast OFF via client kill switch                                 | **Confirmed** for product UX. Server `TransactionEngine.broadcastWithdrawal` / Alchemy `broadcastTransaction` exist but **no HTTP controller** exposes them today.                                                                                                              |

---

# BLOCKCHAIN

## Package / identity

| Field                                              | Value                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| Package                                            | `@auvora/blockchain-service`                                          |
| Path                                               | `services/blockchain`                                                 |
| Default PORT                                       | **3003** (`env.schema.ts`)                                            |
| Nest outDir                                        | `dist` (`tsconfig.json` `rootDir: src`)                               |
| package.json start                                 | `node dist/main.js`                                                   |
| Railway monorepo start (recommended if root build) | `node services/blockchain/dist/main.js`                               |
| Docker CMD                                         | `node dist/main.js` (`Dockerfile.service`)                            |
| Health (liveness)                                  | `GET /health` — `@Public()`, unauthenticated                          |
| Readiness                                          | `GET /ready` — `@Public()`; checks Postgres + Redis                   |
| Extra public probes                                | `GET /health/providers`, `GET /health/providers/:chain` — `@Public()` |

## Build

```bash
pnpm install --frozen-lockfile
pnpm --filter @auvora/database-schema exec prisma generate
pnpm turbo run build --filter=@auvora/blockchain-service
```

Prisma generate is **necessary** (via `@auvora/database` → `@auvora/database-schema`). Dockerfile runs the same generate before turbo build.

**BUILD VERIFIED (local):** 2026-08-08 — turbo build exit 0; typecheck exit 0; jest 12 suites / 56 passed / 1 skipped.

## Networks (CURRENT code)

**Enabled mainnets** (`ENABLED_MAINNETS` in `blockchain.config.ts`):

1. ETHEREUM
2. POLYGON
3. BNB_SMART_CHAIN
4. SOLANA
5. TRON
6. BITCOIN

**Alchemy-supported** = same six (`ALCHEMY_SUPPORTED_CHAINS`).  
**Also registered simulator provider:** Litecoin (`LitecoinProvider` in `CHAIN_PROVIDERS`) — **not** in enabled mainnets / Alchemy map.

## Alchemy env (blockchain service only)

| Name                       | Required?                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `ALCHEMY_API_KEY`          | Yes for Closed Beta prod when primary=alchemy / `ALCHEMY_REQUIRED`                       |
| `ALCHEMY_ETHEREUM_RPC_URL` | Optional override                                                                        |
| `ALCHEMY_POLYGON_RPC_URL`  | Optional                                                                                 |
| `ALCHEMY_BSC_RPC_URL`      | Optional                                                                                 |
| `ALCHEMY_SOLANA_RPC_URL`   | Optional                                                                                 |
| `ALCHEMY_TRON_RPC_URL`     | Optional                                                                                 |
| `ALCHEMY_BITCOIN_RPC_URL`  | Optional                                                                                 |
| `ALCHEMY_RPC_TIMEOUT_MS`   | Optional (default 12000)                                                                 |
| `ALCHEMY_REQUIRED`         | Recommended `true` in prod (defaults true when `NODE_ENV=production` && primary=alchemy) |

**Do not put Alchemy secrets on gateway / Vercel `NEXT_PUBLIC_*` / production mobile dart-defines.**

## Safe Closed Beta flags

| Name                           | Value                                   |
| ------------------------------ | --------------------------------------- |
| `BLOCKCHAIN_SIMULATOR_ENABLED` | `false` (production hard-fails if true) |
| `BLOCKCHAIN_PRIMARY_PROVIDER`  | `alchemy`                               |
| `ALCHEMY_REQUIRED`             | `true`                                  |
| `NODE_ENV`                     | `production`                            |

## Secrets / deps (names only)

| Category                                            | Names                                                                                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Required boot                                       | `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `CSRF_SECRET`                                                                              |
| Alchemy                                             | `ALCHEMY_API_KEY` (or per-chain RPC URLs)                                                                                                    |
| Internal (optional boot; required for internal API) | `INTERNAL_API_KEY`                                                                                                                           |
| Optional URLs                                       | `CUSTODY_SERVICE_URL`, `NOTIFICATIONS_SERVICE_URL`, `AI_SERVICE_URL`, `ANALYTICS_SERVICE_URL`, `OBSERVABILITY_SERVICE_URL`, `APP_PUBLIC_URL` |

## Postgres / Redis

| Resource | Required to boot? | Use                                                                      |
| -------- | ----------------- | ------------------------------------------------------------------------ |
| Postgres | **YES**           | Prisma: chain addresses, txs, blocks, sync jobs, provider health, events |
| Redis    | **YES**           | Ready probe; rate limit; simulator ledger; event bus                     |

## Workers

`SyncService` interval loop runs **only** when `BLOCKCHAIN_SIMULATOR_ENABLED=true`. With simulator **false**, background ledger sync is off; live tip/health via Alchemy providers + `/health/providers`. **Railway-appropriate** as a single long-lived Nest process.

## Public networking

**OFF** — private only. Gateway is the only public surface.

## Broadcast safety (CRITICAL)

### Server paths that can broadcast / send raw tx

| Location                                | Behavior                                             |
| --------------------------------------- | ---------------------------------------------------- |
| `TransactionEngine.broadcastWithdrawal` | Builds hex payload → `provider.broadcastTransaction` |
| `TransactionEngine.rebroadcast`         | Same                                                 |
| Alchemy EVM                             | `eth_sendRawTransaction`                             |
| Alchemy Solana                          | `sendTransaction`                                    |
| Alchemy Bitcoin                         | broadcast RPC                                        |
| Alchemy Tron                            | `eth_sendRawTransaction` or `/wallet/broadcasthex`   |
| Simulator providers                     | Local fake broadcast                                 |

### HTTP exposure

| Surface                        | Exposes broadcast?                                           |
| ------------------------------ | ------------------------------------------------------------ |
| `BlockchainController`         | **NO** — addresses, balances, list txs, fees, network status |
| `AdminBlockchainController`    | **NO** — list/metrics/sync trigger only                      |
| `InternalBlockchainController` | **NO** — addresses/validate/balance/sync/chains              |

**Conclusion:** Live chain broadcast via HTTP is **not currently wired**. Latent engine/provider methods remain callable only if future controllers or internal callers invoke them.

### Client kill switches (product gate)

| Surface | Switch                                                            | Current value                      |
| ------- | ----------------------------------------------------------------- | ---------------------------------- |
| Mobile  | `ReleaseConfig.liveBroadcastEnabled`                              | `false`                            |
| Web     | `ReleaseConfig.liveBroadcastEnabled`                              | `false`                            |
| Helper  | `canUseLiveBroadcast(...)`                                        | always false while kill switch off |
| WC path | `EvmLocalSigner.sendTransactionOrRefuse` / connections controller | refuses when kill switch off       |

**Safe Closed Beta:** keep client kill switches **false**; do not add HTTP broadcast endpoints; keep simulator false + Alchemy read/health only; do **not** enable transaction broadcast.

## Self-custody

**YES** for product wallet path: mobile keys/mnemonics stay on-device (`EvmLocalSigner` / wallet engine). Blockchain service tracks addresses / RPC / optional custody HTTP client when `CUSTODY_SERVICE_URL`+`INTERNAL_API_KEY` set — custody service is **not** in Closed Beta required set. Server does not hold user seed phrases in this service.

## Env cleanup

| Bucket              | Action                                                                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A Keep required     | `NODE_ENV`, `PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `CSRF_SECRET`, `BLOCKCHAIN_SIMULATOR_ENABLED=false`, `BLOCKCHAIN_PRIMARY_PROVIDER=alchemy`, `ALCHEMY_API_KEY`, `ALCHEMY_REQUIRED=true`, `INTERNAL_API_KEY` (for wallet→internal) |
| B Keep optional     | Per-chain `ALCHEMY_*_RPC_URL`, timeouts, OTEL off, optional publisher URLs unset                                                                                                                                                                       |
| C Remove if present | Other services’ secrets (SMTP, Reown secret, field encryption of other services), `NEXT_PUBLIC_*`                                                                                                                                                      |
| D Never             | Alchemy on web/mobile prod binaries                                                                                                                                                                                                                    |

## Production readiness gate

| Gate                           | Status                 |
| ------------------------------ | ---------------------- |
| Build / typecheck / unit tests | **PASS (local)**       |
| Live Alchemy / Railway health  | **NOT VERIFIED**       |
| Env provisioned on Railway     | **NOT VERIFIED**       |
| Verdict                        | **READY TO CONFIGURE** |

---

# CONNECTIONS

## Package / identity

| Field           | Value                                                  |
| --------------- | ------------------------------------------------------ |
| Package         | `@auvora/connections-service`                          |
| Path            | `services/connections`                                 |
| Default PORT    | **3016**                                               |
| Start (package) | `node dist/main.js`                                    |
| Monorepo start  | `node services/connections/dist/main.js`               |
| Health          | `GET /health` `@Public()`                              |
| Ready           | `GET /ready` `@Public()` — DB + Redis + workers status |

## Build

```bash
pnpm install --frozen-lockfile
pnpm --filter @auvora/database-schema exec prisma generate
pnpm turbo run build --filter=@auvora/connections-service
```

**BUILD VERIFIED (local):** turbo build exit 0; typecheck exit 0; jest 8 suites / 27 passed.

## Simulator (CRITICAL)

| Name                            | Default    | Production guard                        |
| ------------------------------- | ---------- | --------------------------------------- |
| `CONNECTIONS_SIMULATOR_ENABLED` | **`true`** | **None** — does not throw in production |

**Must set `CONNECTIONS_SIMULATOR_ENABLED=false` for Closed Beta** or registry keeps simulator first.

With `false`, providers = Ledger-style + WalletConnect-style (both still wrap **simulator-style** adapters — server does **not** embed live Reown WalletKit).

## Reown: client vs server

| Surface                | Reown / WC                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Server connections** | No `REOWN_*` / `WC_PROJECT_ID` env. Session/proposal APIs are style/simulator adapters + Prisma persistence + field encryption. |
| **Mobile**             | Live `ReownWalletKit` via `WC_PROJECT_ID` dart-define (`IntegrationConfig`)                                                     |
| **Web**                | `NEXT_PUBLIC_WC_PROJECT_ID` (Project ID only — public OK)                                                                       |
| **Reown Secret**       | Never on web/mobile public; **not required** on connections Railway service                                                     |

## Required boot env

| Name                               | Notes                     |
| ---------------------------------- | ------------------------- |
| `DATABASE_URL`                     | Required                  |
| `REDIS_URL`                        | Required                  |
| `JWT_ACCESS_SECRET`                | ≥32                       |
| `CSRF_SECRET`                      | ≥32                       |
| `INTERNAL_API_KEY`                 | ≥32 **REQUIRED** (schema) |
| `CONNECTIONS_FIELD_ENCRYPTION_KEY` | ≥32 **REQUIRED**          |
| `CONNECTIONS_SIMULATOR_ENABLED`    | Set **`false`**           |
| `PORT`                             | 3016 recommended          |

Optional service URLs (not required to boot): `WALLET_SERVICE_URL`, `BLOCKCHAIN_SERVICE_URL`, `NFT_SERVICE_URL`, `MARKET_DATA_SERVICE_URL`, `SWAP_SERVICE_URL`, `STAKING_SERVICE_URL`, `NOTIFICATIONS_SERVICE_URL`, `ANALYTICS_SERVICE_URL`, `AI_SERVICE_URL`, `OBSERVABILITY_SERVICE_URL`.

## Postgres / Redis

| Resource | Required? | Use                                                                                   |
| -------- | --------- | ------------------------------------------------------------------------------------- |
| Postgres | YES       | `WalletConnectSession`, `ExternalWalletConnection`, dapp/permission tables, sync jobs |
| Redis    | YES       | Ready; rate limit; worker heartbeats                                                  |

## Workers

`CONNECTIONS_WORKERS_ENABLED` default **true** — interval monitors (connections, sessions, devices, sync, retry, health). Appropriate for Railway single replica. Can set `false` to simplify beta if desired (ready still OK when disabled).

## Sign / broadcast

Server `prepareSign` prepares / stores sign requests — **does not** broadcast on-chain. Live WC `eth_sendTransaction` is gated on mobile by `liveBroadcastEnabled=false`.

## Self-custody

**YES** — connections service stores connection metadata / encrypted pairing material; does not custody user seed phrases. Hardware / WC signing is external or client-side.

## Public networking

**OFF** — private only.

## Env cleanup

| Bucket | Action                                                                                        |
| ------ | --------------------------------------------------------------------------------------------- |
| A      | Required secrets + `CONNECTIONS_SIMULATOR_ENABLED=false` + JWT/CSRF/INTERNAL/field encryption |
| B      | Worker intervals / optional URL publishers                                                    |
| C      | Remove Alchemy, SMTP, Reown **Secret**, unrelated keys                                        |
| D      | Never put field encryption / INTERNAL on `NEXT_PUBLIC_*`                                      |

## Production readiness gate

| Gate                             | Status                                       |
| -------------------------------- | -------------------------------------------- |
| Build / tests                    | **PASS (local)**                             |
| Live Railway / Reown device pair | **NOT VERIFIED**                             |
| Verdict                          | **READY TO CONFIGURE** (pin simulator false) |

---

# MARKET DATA

## Package / identity

| Field           | Value                                    |
| --------------- | ---------------------------------------- |
| Package         | `@auvora/market-data-service`            |
| Path            | `services/market-data`                   |
| Default PORT    | **3012**                                 |
| Start (package) | `node dist/main.js`                      |
| Monorepo start  | `node services/market-data/dist/main.js` |
| Health / ready  | `GET /health`, `GET /ready` `@Public()`  |

## Build

```bash
pnpm install --frozen-lockfile
pnpm --filter @auvora/database-schema exec prisma generate
pnpm turbo run build --filter=@auvora/market-data-service
```

**BUILD VERIFIED (local):** turbo build exit 0; typecheck exit 0; jest 7 suites / 13 passed.

## Providers (CURRENT **server** code)

| Priority | Provider  | When                                                  |
| -------- | --------- | ----------------------------------------------------- |
| Primary  | Simulator | if `MARKET_DATA_SIMULATOR_ENABLED=true` (**default**) |
| Primary  | CoinGecko | if simulator **false**                                |
| Fallback | Simulator | if CoinGecko throws                                   |

**No CoinCap. No Alchemy Prices** in `services/market-data`.

### Mobile client (not this Railway service)

Order in `PriceService`: CoinGecko → CoinCap → Alchemy Prices → seeded. Alchemy client key optional via dart-define — **do not** inject production Alchemy into release APKs.

## Simulator (CRITICAL)

| Name                            | Default    | Production guard |
| ------------------------------- | ---------- | ---------------- |
| `MARKET_DATA_SIMULATOR_ENABLED` | **`true`** | **None**         |

**Must set `MARKET_DATA_SIMULATOR_ENABLED=false` for live CoinGecko.**

## Required boot env

| Name                               | Notes                                  |
| ---------------------------------- | -------------------------------------- |
| `DATABASE_URL`                     | Required                               |
| `REDIS_URL`                        | Required                               |
| `JWT_ACCESS_SECRET`                | ≥32                                    |
| `CSRF_SECRET`                      | ≥32                                    |
| `INTERNAL_API_KEY`                 | ≥32 **REQUIRED**                       |
| `MARKET_DATA_FIELD_ENCRYPTION_KEY` | ≥32 **REQUIRED**                       |
| `MARKET_DATA_SIMULATOR_ENABLED`    | Set **`false`**                        |
| `COINGECKO_API_KEY`                | Optional (rate limits better with key) |
| `COINGECKO_BASE_URL`               | Optional default public API            |

Optional: `WALLET_SERVICE_URL`, `NOTIFICATIONS_SERVICE_URL`, `ANALYTICS_SERVICE_URL`, `OBSERVABILITY_SERVICE_URL`.

## Postgres / Redis

| Resource | Required? | Use                                                   |
| -------- | --------- | ----------------------------------------------------- |
| Postgres | YES       | quotes, watchlists, alerts, provider health           |
| Redis    | YES       | price/metadata/portfolio/trending caches + rate limit |

## Workers

`MARKET_DATA_WORKERS_ENABLED` default **true** — price, metadata, portfolio, cache, history, alert intervals. Railway-appropriate; optional to disable for quieter beta.

## Public networking

**OFF** — private only.

## Self-custody

**N/A / YES** — market-data does not hold keys; pricing only.

## Env cleanup

| Bucket | Action                                                              |
| ------ | ------------------------------------------------------------------- |
| A      | DB/Redis/JWT/CSRF/INTERNAL/field encryption + simulator false       |
| B      | CoinGecko key, worker intervals, optional URLs                      |
| C      | Remove Alchemy server key (belongs on blockchain only), Reown, SMTP |
| D      | Never `NEXT_PUBLIC_` secrets                                        |

## Production readiness gate

| Gate                     | Status                 |
| ------------------------ | ---------------------- |
| Build / tests            | **PASS (local)**       |
| Live CoinGecko / Railway | **NOT VERIFIED**       |
| Verdict                  | **READY TO CONFIGURE** |

---

# EXISTING SERVICES CONSISTENCY

Read-only check of gateway / auth / wallet vs remaining three:

| Check                | Result                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Gateway defaults     | `BLOCKCHAIN_SERVICE_URL` → `:3003`, `MARKET_DATA` → `:3012`, `CONNECTIONS` → `:3016` — matches service defaults                       |
| Gateway proxies      | `/api/v1/blockchain` + admin; `/api/v1/connections` + admin; `/api/v1/market-data` + admin                                            |
| Gateway public       | Only gateway should be public — consistent with plan                                                                                  |
| Auth JWT/CSRF names  | `JWT_ACCESS_SECRET`, `CSRF_SECRET` — same names as remaining services                                                                 |
| Wallet → blockchain  | `BLOCKCHAIN_SERVICE_URL` **optional** in wallet schema (docs often say required for Closed Beta — set it for live address validation) |
| Wallet → market-data | `MARKET_DATA_SERVICE_URL` optional; `INTERNAL_API_KEY` **required** on wallet                                                         |
| Blockchain INTERNAL  | optional boot; wallet internal calls need key present on **both** ends                                                                |
| NFT                  | ABSENT / gateway 410 path — unchanged; do not deploy nft                                                                              |

**LIVE URL wiring on Railway:** **NOT VERIFIED**.

---

# SECURITY

| Topic                                | Verdict                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Public OFF for three                 | **Required / code-aligned**                                                                          |
| Gateway only public                  | **Required**                                                                                         |
| Broadcast                            | Client kill switch **OFF**; server HTTP broadcast **not exposed**                                    |
| Alchemy                              | Server blockchain only                                                                               |
| Reown                                | Project ID on clients; **no** server Reown secrets on connections                                    |
| Field encryption keys                | Server-only on connections / market-data                                                             |
| `NEXT_PUBLIC_*` / Flutter            | Must not receive JWT, CSRF, INTERNAL, Alchemy prod key, field encryption, SMTP, Reown Secret         |
| Mobile `ALCHEMY_API_KEY` dart-define | Supported for **dev** prices/RPC — **forbidden for production APK** per `IntegrationConfig` comments |
| Self-custody product path            | **YES** (on-device keys)                                                                             |

---

# RAILWAY DEPENDENCY GRAPH

```text
                    [Internet]
                         │
                         ▼
              ┌─────────────────────┐
              │ gateway :4000       │  PUBLIC
              │ (only public)       │
              └──────────┬──────────┘
     private *_SERVICE_URL│
     ┌───────────┬───────┼────────┬────────────┐
     ▼           ▼       ▼        ▼            ▼
  auth:4001  wallet  blockchain connections market-data
             :3002    :3003      :3016       :3012
     │           │       │        │            │
     └───────────┴───────┴────┬───┴────────────┘
                              ▼
                 Postgres 16 + Redis 7 (private)
                              │
                    Alchemy egress ← blockchain only
                    CoinGecko egress ← market-data (when sim false)
```

## REQUIRED TO BOOT vs OPTIONAL (per remaining service)

| Dependency                      | blockchain                          | connections | market-data                                     |
| ------------------------------- | ----------------------------------- | ----------- | ----------------------------------------------- |
| Postgres                        | REQUIRED                            | REQUIRED    | REQUIRED                                        |
| Redis                           | REQUIRED                            | REQUIRED    | REQUIRED                                        |
| JWT_ACCESS_SECRET / CSRF_SECRET | REQUIRED                            | REQUIRED    | REQUIRED                                        |
| INTERNAL_API_KEY                | optional boot / needed for internal | REQUIRED    | REQUIRED                                        |
| Field encryption key            | N/A                                 | REQUIRED    | REQUIRED                                        |
| Alchemy                         | REQUIRED for prod alchemy primary   | N/A         | N/A                                             |
| CoinGecko                       | N/A                                 | N/A         | REQUIRED path when sim false (API key optional) |
| Other `*_SERVICE_URL`           | optional                            | optional    | optional                                        |
| Gateway                         | not required to boot domain service | same        | same                                            |

---

# RAILWAY DEPLOYMENT ORDER

Verified dependency order for Closed Beta (not an example-only list):

1. **Postgres 16** (+ citext) — provision; run `prisma migrate deploy` **once** (ops; not done this pass)
2. **Redis 7**
3. Shared secrets group: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `CSRF_SECRET`, `INTERNAL_API_KEY`
4. **auth** (already in required set; login path)
5. **blockchain** (Alchemy + sim false) — wallet benefits from URL
6. **wallet** (set `BLOCKCHAIN_SERVICE_URL`, `INTERNAL_API_KEY`)
7. **market-data** (sim false + field encryption)
8. **connections** (sim false + field encryption)
9. **gateway** last for traffic — wire all five private URLs; **public networking ON only here**
10. Point `NEXT_PUBLIC_API_URL` at public gateway (**Vercel ops — do not change in this audit**)

**Do not** deploy nft / deferred services for Closed Beta.

---

# FINAL SERVICE STATUS

| Service            | Networking | Build                 | Config readiness                     | Live Railway | Overall            |
| ------------------ | ---------- | --------------------- | ------------------------------------ | ------------ | ------------------ |
| blockchain         | Private    | **VERIFIED**          | READY TO CONFIGURE                   | NOT VERIFIED | READY TO CONFIGURE |
| connections        | Private    | **VERIFIED**          | READY TO CONFIGURE (pin sim false)   | NOT VERIFIED | READY TO CONFIGURE |
| market-data        | Private    | **VERIFIED**          | READY TO CONFIGURE (pin sim false)   | NOT VERIFIED | READY TO CONFIGURE |
| gateway (existing) | Public     | NOT REBUILT this pass | Wire private URLs after three deploy | NOT VERIFIED | DEPENDENT          |

---

## Recommended Railway settings (per service)

| Setting               | blockchain                                                     | connections                              | market-data                              |
| --------------------- | -------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| Root directory        | `/` (monorepo)                                                 | `/`                                      | `/`                                      |
| Builder               | Docker `Dockerfile.service` **or** Railpack custom build (ops) | same                                     | same                                     |
| Docker build-args     | `SERVICE=blockchain` `PORT=3003`                               | `SERVICE=connections` `PORT=3016`        | `SERVICE=market-data` `PORT=3012`        |
| Railpack-style build  | install + prisma generate + turbo filter (see above)           | same pattern                             | same pattern                             |
| Start (Railpack root) | `node services/blockchain/dist/main.js`                        | `node services/connections/dist/main.js` | `node services/market-data/dist/main.js` |
| Healthcheck path      | `/health`                                                      | `/health`                                | `/health`                                |
| Public networking     | **OFF**                                                        | **OFF**                                  | **OFF**                                  |
| PORT env              | Prefer explicit `3003` (Railway may inject `PORT`)             | `3016`                                   | `3012`                                   |
| Port collision        | N/A across separate containers; avoid sharing one container    | same                                     | same                                     |

---

## Final Gateway URL wiring map

Use Railway private DNS / variable references (placeholder — select actual private hostnames in dashboard):

| Gateway env               | Value pattern                                              |
| ------------------------- | ---------------------------------------------------------- |
| `BLOCKCHAIN_SERVICE_URL`  | `RAILWAY_PRIVATE_URL_TO_BE_SELECTED` → blockchain `:3003`  |
| `CONNECTIONS_SERVICE_URL` | `RAILWAY_PRIVATE_URL_TO_BE_SELECTED` → connections `:3016` |
| `MARKET_DATA_SERVICE_URL` | `RAILWAY_PRIVATE_URL_TO_BE_SELECTED` → market-data `:3012` |
| `AUTH_SERVICE_URL`        | private auth `:4001`                                       |
| `WALLET_SERVICE_URL`      | private wallet `:3002`                                     |
| Deferred `*_SERVICE_URL`  | leave defaults / unused — degrade 502/503                  |

Wallet (optional but Closed Beta recommended):

| Wallet env                | Value                                              |
| ------------------------- | -------------------------------------------------- |
| `BLOCKCHAIN_SERVICE_URL`  | `RAILWAY_PRIVATE_URL_TO_BE_SELECTED` (blockchain)  |
| `MARKET_DATA_SERVICE_URL` | `RAILWAY_PRIVATE_URL_TO_BE_SELECTED` (market-data) |
| `INTERNAL_API_KEY`        | same shared secret as domain services              |

---

## Failure / resilience (blockers only)

| Risk                                                                                     | Severity                         | Mitigation                        |
| ---------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------- |
| Forgetting `CONNECTIONS_SIMULATOR_ENABLED=false` / `MARKET_DATA_SIMULATOR_ENABLED=false` | **Config blocker for live mode** | Pin false in Railway vars         |
| Missing field encryption keys                                                            | **Boot blocker**                 | Set ≥32 char secrets              |
| Missing Alchemy when `ALCHEMY_REQUIRED`                                                  | **Boot blocker** (blockchain)    | Set `ALCHEMY_API_KEY`             |
| Missing `INTERNAL_API_KEY` on connections/market-data                                    | **Boot blocker**                 | Shared secret                     |
| Prisma migrations not deployed                                                           | **Runtime blocker**              | migrate deploy before traffic     |
| Enabling live broadcast kill switch                                                      | **Safety blocker**               | Keep `liveBroadcastEnabled=false` |

No code build blockers found this pass.

---

## Local verification summary

| Check                                 | Result                         |
| ------------------------------------- | ------------------------------ |
| `prisma generate`                     | PASS                           |
| turbo build ×3                        | **BUILD VERIFIED**             |
| typecheck ×3                          | PASS                           |
| unit tests ×3                         | PASS (56+27+13)                |
| Live Railway deploy                   | **LIVE EXTERNAL NOT VERIFIED** |
| Live Alchemy / CoinGecko from Railway | **NOT VERIFIED**               |
| Code fixes applied                    | **None**                       |

---

# OVERALL RAILWAY BACKEND + REMAINING BLOCKERS + ONE NEXT MANUAL ACTION

**Overall status: READY TO CONFIGURE** (not READY TO DEPLOY — live Railway, secrets, migrate, and private URL wiring are unverified / not executed).

**Remaining blockers (ops, not code):**

1. Provision/configure private Railway services for blockchain, connections, market-data (or attach env to existing).
2. Pin simulator flags **false**; set field encryption + INTERNAL + Alchemy (blockchain).
3. Ensure Postgres migrate deploy completed once.
4. Wire gateway (and wallet) `*_SERVICE_URL` to private hosts.
5. Keep Public OFF on the three; keep broadcast kill switch OFF.

**ONE NEXT MANUAL ACTION:** In Railway, create/configure the three **private** services from monorepo root using `infrastructure/docker/Dockerfile.service` (`SERVICE`/`PORT` build-args) **or** equivalent Railpack build+start commands above; set shared `DATABASE_URL`/`REDIS_URL`/JWT/CSRF/`INTERNAL_API_KEY`, blockchain Alchemy + `BLOCKCHAIN_SIMULATOR_ENABLED=false`, and **`CONNECTIONS_SIMULATOR_ENABLED=false`** + **`MARKET_DATA_SIMULATOR_ENABLED=false`** with their field-encryption keys — then wire gateway private URLs (`RAILWAY_PRIVATE_URL_TO_BE_SELECTED`).

---

_End of independent re-verification. Source: `D:\auvora-wallet` service env schemas, providers, controllers, gateway proxies, client release configs, Dockerfile.service, local turbo/jest/tsc._
