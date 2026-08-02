# Auvora Wallet — Existing API & RPC Configuration Audit

**Date:** 2026-08-02  
**Scope:** Audit only — no credentials modified, no live broadcast enabled, no source/config changes beyond this document  
**Method:** Source inspection of env templates, local env key presence (values never printed), Dart/TS config, RPC providers, CI/Helm, and related docs  
**Secret rule:** Variable names and presence only. RPC URLs with keys shown as `…/v2/***REDACTED***`.

---

## Executive summary

1. **Existing API providers:** Alchemy (backend primary + mobile URL builder), CoinGecko, CoinCap, seeded offline prices, public RPCs (PublicNode, Cloudflare, Ankr, Solana public, Mempool/Blockstream, TronGrid), WalletConnect/Reown (preview + `WC_PROJECT_ID` hook), MoonPay/Ramp/Transak (gated widgets), Helius-style NFT sim only, Infura/QuickNode not wired (URL overrides only).
2. **Existing environment variable names:** See §2 table. Core RPC credential: `ALCHEMY_API_KEY` (+ optional `ALCHEMY_*_RPC_URL`). Mobile also uses `ETH_RPC_URL` / `*_RPC_URL_BACKUP`, market keys, on-ramp keys, `WC_PROJECT_ID`.
3. **Existing Alchemy configuration:** Full backend stack under `services/blockchain/.../alchemy/*`; mobile constructs Alchemy hosts when `ALCHEMY_API_KEY` is passed via `--dart-define`. Local root `.env` has `ALCHEMY_API_KEY` **PRESENT_SET** (gitignored). Mobile has no local `.env`; dart-define default is empty.
4. **Old/duplicate configuration:** One shared key name (`ALCHEMY_API_KEY`) used by backend env and mobile dart-define (separate injection paths). Per-chain `ALCHEMY_*_RPC_URL` templates exist but are **MISSING** from local root `.env`. Hard-coded Alchemy **hostnames** in source (not keys). Historical docs note a key once shared in plaintext — rotate recommended.
5. **Supported networks:** Mobile claims **6**: Bitcoin, Ethereum, Solana, BNB Smart Chain, Tron, Polygon. Backend Alchemy primary claims **5**: Ethereum, BNB Smart Chain, Solana, Tron, Bitcoin (Polygon/Litecoin not Alchemy-primary). Base / Arbitrum / Optimism: **not** configured.
6. **Current RPC provider per network:** Mobile default = public tip endpoints (Alchemy preferred only if dart-define key set). Backend default policy = Alchemy when credentials exist (`BLOCKCHAIN_PRIMARY_PROVIDER=alchemy`).
7. **Current price providers:** Mobile: **CoinGecko → CoinCap → seeded**. Backend market-data: CoinGecko when simulator off, else simulator. No Alchemy Prices API found.
8. **Send/Receive status:** Send UI + preview broadcast **implemented**; live broadcast **off** (`liveBroadcastEnabled=false`). Receive UI exists; funding QR/copy/share **locked** (`allowFundingAddresses=false`).
9. **Credential security problems:** No real Alchemy keys found in git-tracked source. Local `.env` is gitignored and holds a set key. Risk: mobile `--dart-define=ALCHEMY_API_KEY` would bundle the key into the APK. Docs historically advised rotating a key shared in plaintext. Test fixtures use fake placeholders only.
10. **NEW Auvora Wallet Alchemy API key target:** Put the new key in local root **`ALCHEMY_API_KEY`** (file: `D:\auvora-wallet\.env`, gitignored). Prefer that single backend variable; do **not** activate live broadcast or replace keys in this audit. Optional later: same name via mobile `--dart-define` for tip probes only (prefer keeping production RPC keys server-side).

---

## 1. Existing API configuration inventory

### 1.1 Files / surfaces inspected

| Surface             | Path                                                                                                                                                                              | Finding                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Root env (local)    | `.env`                                                                                                                                                                            | **Exists**, gitignored. Contains set `ALCHEMY_API_KEY`, `BLOCKCHAIN_PRIMARY_PROVIDER=alchemy`, `BLOCKCHAIN_SIMULATOR_ENABLED=false`.        |
| Root templates      | `.env.example`, `.env.staging.example`, `.env.production.example`                                                                                                                 | Tracked; Alchemy placeholders empty / `<secret>`.                                                                                           |
| Mobile env template | `apps/mobile/.env.example`                                                                                                                                                        | Tracked; documents dart-define keys. **No** `apps/mobile/.env` on disk.                                                                     |
| Web local env       | `apps/web/.env.local`                                                                                                                                                             | **Exists**, gitignored. Only `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME` (no Alchemy).                                                    |
| Admin local env     | `apps/admin/.env.local`                                                                                                                                                           | **Exists**, gitignored. Same public Next vars only.                                                                                         |
| Android local props | `apps/mobile/android/local.properties`                                                                                                                                            | **Exists**, gitignored. Keys: `flutter.sdk`, `sdk.dir`, `flutter.buildMode`, `flutter.versionName`, `flutter.versionCode` (SDK paths only). |
| Dart integration    | `apps/mobile/lib/release/integration_config.dart`                                                                                                                                 | Compile-time `--dart-define` surface for all mobile API/RPC secrets.                                                                        |
| Dart release gates  | `apps/mobile/lib/release/release_config.dart`                                                                                                                                     | `liveBroadcastEnabled=false`, `allowFundingAddresses=false`, `liveMarketPricesEnabled=true`.                                                |
| Network / RPC       | `network_manager.dart`, `rpc_endpoints.dart`, `rpc_health_probe.dart`                                                                                                             | Public + optional Alchemy/override pools; tip probes only.                                                                                  |
| Prices              | `price_service.dart` + CoinGecko/CoinCap/seeded providers                                                                                                                         | Failover order documented below.                                                                                                            |
| Backend Alchemy     | `services/blockchain/src/infrastructure/providers/alchemy/*`                                                                                                                      | Live providers for 5 mainnets.                                                                                                              |
| Backend env schema  | `services/blockchain/src/config/env.schema.ts`                                                                                                                                    | Validates Alchemy + primary provider mode.                                                                                                  |
| Network registry    | `services/blockchain/src/config/blockchain.config.ts`                                                                                                                             | Enabled mainnets + Alchemy hosts.                                                                                                           |
| Verify script       | `scripts/verify-alchemy-rpc.mjs`                                                                                                                                                  | Live probe; reads `ALCHEMY_API_KEY`; redacts in output.                                                                                     |
| Helm                | `infrastructure/helm/auvora-wallet/values.yaml`                                                                                                                                   | ExternalSecret key list includes `ALCHEMY_API_KEY`.                                                                                         |
| CI workflows        | `.github/workflows/*`                                                                                                                                                             | **No** `ALCHEMY_API_KEY` / dart-define injection found in workflow YAML.                                                                    |
| Prior docs          | `API_AND_INTEGRATIONS_GUIDE.md`, `ALCHEMY_CONFIGURATION.md`, `ALCHEMY_INTEGRATION.md`, `ALCHEMY_INTEGRATION_REPORT.md`, `INTEGRATION_READINESS_AUDIT.md`, `RC1_SECURITY_AUDIT.md` | Consistent with code; older readiness audit said templates empty — local `.env` now has a set key (gitignored).                             |

### 1.2 Provider search results

| Provider / keyword                 | Present?         | Where / how                                                                                                                   |
| ---------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Alchemy**                        | **Yes**          | Backend providers + mobile `RpcEndpoints._alchemyUrls`; root/mobile env templates; Helm; verify script.                       |
| **CoinGecko**                      | **Yes**          | Mobile `CoinGeckoMarketDataProvider`; backend `services/market-data` `CoinGeckoMarketProvider`; optional `COINGECKO_API_KEY`. |
| **CoinCap**                        | **Yes**          | Mobile failover provider; optional `COINCAP_API_KEY`.                                                                         |
| **PublicNode**                     | **Yes**          | Mobile public defaults (ETH/Polygon/BSC/Solana/Tron).                                                                         |
| **Cloudflare**                     | **Yes**          | `https://cloudflare-eth.com` in mobile ETH public pool.                                                                       |
| **Ankr**                           | **Yes**          | Public `rpc.ankr.com/{eth,polygon,bsc}` in mobile defaults (no Ankr API key).                                                 |
| **Infura**                         | **Mention only** | Guide says use `*_RPC_URL` overrides; no Infura SDK/key vars.                                                                 |
| **QuickNode**                      | **No**           | Not found as wired provider.                                                                                                  |
| **Helius**                         | **Sim only**     | `services/nft` `HeliusStyleProvider` (`helius_sim`) — not live Helius RPC.                                                    |
| **Solana RPC**                     | **Yes**          | Alchemy host + public Solana / PublicNode.                                                                                    |
| **Bitcoin RPC**                    | **Yes**          | Backend Alchemy Bitcoin; mobile tip via Mempool/Blockstream REST (not JSON-RPC).                                              |
| **Ethereum / Polygon / BSC RPC**   | **Yes**          | Mobile public + optional Alchemy; backend Alchemy for ETH/BSC (Polygon not Alchemy-primary on backend).                       |
| **Base / Arbitrum / Optimism RPC** | **No**           | Not in `ChainId`, `ENABLED_MAINNETS`, or Alchemy host maps.                                                                   |
| **Tron RPC**                       | **Yes**          | Backend Alchemy Tron; mobile TronGrid + PublicNode (Alchemy URL **not** built on mobile for Tron).                            |
| **WalletConnect / Reown**          | **Preview**      | `WC_PROJECT_ID` hook; `PreviewWalletConnectProvider` (`isLiveRelay == false`).                                                |
| **MoonPay / Ramp / Transak**       | **Gated**        | Publishable key dart-defines + `ONRAMP_PARTNER_CHECKOUT_ENABLED` (default false).                                             |
| **Alchemy Prices API**             | **No**           | Not referenced in price architecture.                                                                                         |

---

## 2. Environment variable names (values never shown)

### 2.1 Blockchain / Alchemy (backend + root templates)

| VARIABLE NAME                  | PROVIDER | PURPOSE                                                    | LOCATION                                                                                            | PRESENT/MISSING (local root `.env`)      | USED/UNUSED                                                                                        |
| ------------------------------ | -------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ALCHEMY_API_KEY`              | Alchemy  | Shared key → construct per-chain `https://<host>/v2/<key>` | Root `.env` / examples; blockchain `env.schema.ts`; Helm ExternalSecret; mobile `IntegrationConfig` | **PRESENT_SET** (gitignored `.env`)      | **USED** by backend when service boots with env; mobile **UNUSED** unless `--dart-define` at build |
| `ALCHEMY_ETHEREUM_RPC_URL`     | Alchemy  | Explicit ETH RPC override                                  | `.env.example`, staging example (commented), `env.schema.ts`                                        | **MISSING** from local `.env`            | USED when set (overrides key-built URL)                                                            |
| `ALCHEMY_BSC_RPC_URL`          | Alchemy  | Explicit BSC RPC override                                  | Same                                                                                                | **MISSING**                              | USED when set                                                                                      |
| `ALCHEMY_SOLANA_RPC_URL`       | Alchemy  | Explicit Solana RPC override                               | Same                                                                                                | **MISSING**                              | USED when set                                                                                      |
| `ALCHEMY_TRON_RPC_URL`         | Alchemy  | Explicit Tron RPC override                                 | Same                                                                                                | **MISSING**                              | USED when set                                                                                      |
| `ALCHEMY_BITCOIN_RPC_URL`      | Alchemy  | Explicit Bitcoin RPC override                              | Same                                                                                                | **MISSING**                              | USED when set                                                                                      |
| `ALCHEMY_RPC_TIMEOUT_MS`       | Alchemy  | JSON-RPC timeout (default 12000)                           | Examples + schema                                                                                   | **MISSING** (defaults apply)             | USED (default)                                                                                     |
| `ALCHEMY_REQUIRED`             | Alchemy  | Fail boot if Alchemy missing                               | `.env.example` (commented); schema                                                                  | **MISSING** (prod default logic applies) | USED when set / production primary                                                                 |
| `BLOCKCHAIN_PRIMARY_PROVIDER`  | Policy   | `alchemy` \| `simulator`                                   | Root `.env` + examples                                                                              | **PRESENT** (`alchemy`)                  | **USED**                                                                                           |
| `BLOCKCHAIN_SIMULATOR_ENABLED` | Policy   | Simulator ledger / prod guard                              | Root `.env` + examples                                                                              | **PRESENT** (`false`)                    | **USED**                                                                                           |
| `ALCHEMY_LIVE_TEST`            | Alchemy  | Gate live provider tests                                   | Docs (`ALCHEMY_INTEGRATION.md`)                                                                     | Not in local `.env`                      | USED only when testing                                                                             |

### 2.2 Mobile dart-define / `apps/mobile/.env.example`

| VARIABLE NAME                                | PROVIDER              | PURPOSE                               | LOCATION                                         | PRESENT/MISSING                             | USED/UNUSED                                         |
| -------------------------------------------- | --------------------- | ------------------------------------- | ------------------------------------------------ | ------------------------------------------- | --------------------------------------------------- |
| `ALCHEMY_API_KEY`                            | Alchemy               | Prefer Alchemy URLs in `RpcEndpoints` | `integration_config.dart`, mobile `.env.example` | No mobile `.env`; compile default **empty** | Config-ready; **unused** until dart-define injected |
| `ETH_RPC_URL` / `ETH_RPC_URL_BACKUP`         | Any RPC               | Override ETH pool                     | Same                                             | Empty defaults                              | USED when non-empty                                 |
| `POLYGON_RPC_URL` / `POLYGON_RPC_URL_BACKUP` | Any RPC               | Override Polygon                      | Same                                             | Empty defaults                              | USED when non-empty                                 |
| `BSC_RPC_URL` / `BSC_RPC_URL_BACKUP`         | Any RPC               | Override BSC                          | Same                                             | Empty defaults                              | USED when non-empty                                 |
| `SOL_RPC_URL` / `SOL_RPC_URL_BACKUP`         | Any RPC               | Override Solana                       | Same                                             | Empty defaults                              | USED when non-empty                                 |
| `BTC_RPC_URL` / `BTC_RPC_URL_BACKUP`         | Tip REST              | Override BTC tip URLs                 | Same                                             | Empty defaults                              | USED when non-empty                                 |
| `TRON_RPC_URL` / `TRON_RPC_URL_BACKUP`       | Any RPC               | Override Tron                         | Same                                             | Empty defaults                              | USED when non-empty                                 |
| `RPC_HEALTH_PROBE_ENABLED`                   | Internal              | Enable tip probes (default true)      | Same                                             | Default true                                | **USED**                                            |
| `COINGECKO_API_KEY`                          | CoinGecko             | Optional Demo/Pro header              | Same + root `.env.example` (commented)           | Root: **MISSING**; mobile default empty     | USED when set; anonymous works without              |
| `COINCAP_API_KEY`                            | CoinCap               | Optional Bearer                       | Mobile example                                   | Default empty                               | USED when set                                       |
| `WC_PROJECT_ID`                              | Reown / WalletConnect | Project ID for future live relay      | Mobile example                                   | Default empty                               | Hook only; preview WC does not need it live         |
| `MOONPAY_API_KEY`                            | MoonPay               | Publishable widget key                | Mobile example                                   | Default empty                               | Gated; unused until checkout enabled + key          |
| `RAMP_API_KEY`                               | Ramp                  | Publishable / host key                | Mobile example                                   | Default empty                               | Same                                                |
| `TRANSAK_API_KEY`                            | Transak               | Publishable key                       | Mobile example                                   | Default empty                               | Same                                                |
| `ONRAMP_PARTNER_CHECKOUT_ENABLED`            | On-ramp gate          | Allow opening partner widgets         | Mobile example                                   | Default **false**                           | **USED** (gate)                                     |
| `SENTRY_DSN` / `SENTRY_ENABLED`              | Sentry                | Crash reporting hooks                 | Mobile example                                   | Defaults empty/false                        | Hook only; no SDK package wired                     |

### 2.3 Market-data service

| VARIABLE NAME                   | PROVIDER  | PURPOSE                      | LOCATION                                                                  | PRESENT/MISSING                                        | USED/UNUSED                     |
| ------------------------------- | --------- | ---------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------- |
| `COINGECKO_API_KEY`             | CoinGecko | Backend quotes               | `services/market-data/.../env.schema.ts`, root `.env.example` (commented) | **MISSING** from local `.env`                          | USED when simulator off         |
| `COINGECKO_BASE_URL`            | CoinGecko | API base (default public v3) | market-data schema                                                        | Default in code                                        | **USED**                        |
| `MARKET_DATA_SIMULATOR_ENABLED` | Internal  | Force simulator quotes       | root `.env.example`                                                       | **MISSING** from local `.env` (example default `true`) | **USED** when service loads env |

### 2.4 Web / admin local

| VARIABLE NAME          | PROVIDER       | PURPOSE          | LOCATION                                       | PRESENT/MISSING | USED/UNUSED |
| ---------------------- | -------------- | ---------------- | ---------------------------------------------- | --------------- | ----------- |
| `NEXT_PUBLIC_API_URL`  | Auvora gateway | Public API base  | `apps/web/.env.local`, `apps/admin/.env.local` | **PRESENT_SET** | **USED**    |
| `NEXT_PUBLIC_APP_NAME` | Branding       | App display name | Same                                           | **PRESENT_SET** | **USED**    |

No web Alchemy / CoinGecko / WC secrets in local web env.

### 2.5 Git tracking status

| File                                                                                          | Tracked?                      |
| --------------------------------------------------------------------------------------------- | ----------------------------- |
| `.env`                                                                                        | **No** (gitignore)            |
| `apps/web/.env.local`                                                                         | **No**                        |
| `apps/admin/.env.local`                                                                       | **No**                        |
| `apps/mobile/android/local.properties`                                                        | **No** (android `.gitignore`) |
| `.env.example`, `.env.staging.example`, `.env.production.example`, `apps/mobile/.env.example` | **Yes** (placeholders only)   |

---

## 3. Old Alchemy configuration (do not delete — inventory only)

| Item                                           | Exists?                | Detail                                                                                                                                                                                                                                           |
| ---------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Old / existing Alchemy API key (name/location) | **Yes (local)**        | Variable **`ALCHEMY_API_KEY`** in gitignored root **`.env`** — status **PRESENT_SET**. Value not printed.                                                                                                                                        |
| Multiple Alchemy keys in templates             | **No**                 | Single shared key name; optional per-chain **URL** overrides (not separate keys).                                                                                                                                                                |
| Multiple injection paths for same name         | **Yes**                | (1) Backend/process env / Helm secret `ALCHEMY_API_KEY`; (2) Mobile `--dart-define=ALCHEMY_API_KEY`. Same name, different runtimes.                                                                                                              |
| Old Alchemy RPC URLs (explicit env)            | **No in local `.env`** | `ALCHEMY_*_RPC_URL` all **MISSING** locally; code builds URLs from key + hosts.                                                                                                                                                                  |
| Hard-coded Alchemy **endpoints** (hosts)       | **Yes**                | See §3.1 — hosts only; key interpolated at runtime.                                                                                                                                                                                              |
| Unused Alchemy configuration                   | **Partial**            | Mobile Alchemy URL builder idle without dart-define. Backend Tron/Bitcoin Alchemy hosts configured; mobile does **not** map Alchemy for BTC/TRON tip pools. Polygon Alchemy on mobile only (backend Polygon stays non-Alchemy-primary per docs). |
| Historical plaintext exposure                  | **Documented**         | `docs/ALCHEMY_INTEGRATION_REPORT.md` recommends rotating a key previously shared in plaintext — treat current local key as potentially compromised until rotated.                                                                                |

### 3.1 Hard-coded Alchemy hostnames (no keys in source)

**Backend** (`alchemy-rpc.config.ts` / `blockchain.config.ts`):

- `eth-mainnet.g.alchemy.com`
- `bnb-mainnet.g.alchemy.com`
- `solana-mainnet.g.alchemy.com`
- `tron-mainnet.g.alchemy.com`
- `bitcoin-mainnet.g.alchemy.com`

URL shape: `https://<host>/v2/<ALCHEMY_API_KEY>` → report as `https://<host>/v2/***REDACTED***`.

**Mobile** (`rpc_endpoints.dart`) when key present:

- Ethereum → `https://eth-mainnet.g.alchemy.com/v2/$key`
- Polygon → `https://polygon-mainnet.g.alchemy.com/v2/$key`
- BSC → `https://bnb-mainnet.g.alchemy.com/v2/$key`
- Solana → `https://solana-mainnet.g.alchemy.com/v2/$key`
- Bitcoin / Tron → **empty** Alchemy list (public tip endpoints only)

**Tests / docs:** Fake paths like `…/v2/super-secret-key` or `{key}` placeholders — not production secrets.

---

## 4. Network map

### 4.1 Kill switches (actual code)

| Flag                                  | File                                          | Value            |
| ------------------------------------- | --------------------------------------------- | ---------------- |
| `ReleaseConfig.liveBroadcastEnabled`  | `apps/mobile/lib/release/release_config.dart` | **`false`**      |
| `ReleaseConfig.allowFundingAddresses` | same                                          | **`false`**      |
| Web mirror                            | `apps/web/src/lib/release/config.ts`          | Both **`false`** |

Mobile adapters in `main.dart` are exclusively `PreviewBlockchainAdapter` (`providerCode: *-sim`). Balances/history are **deterministic preview**, not live RPC reads. `broadcast()` always returns `preview: true`.

### 4.2 Per-network matrix

Status columns are grounded in code flags/adapters (not assumed EVM parity).

| NETWORK         | CHAIN TYPE | CURRENT PRIMARY RPC (mobile default, no dart-define Alchemy) | CURRENT FALLBACK RPC (mobile)       | ALCHEMY SUPPORT CONFIGURED?                                                                                | READ BALANCE WORKING?                                                                | TRANSACTION HISTORY WORKING?                                                                              | SEND IMPLEMENTED?       | RECEIVE IMPLEMENTED?             | LIVE BROADCAST ENABLED? |
| --------------- | ---------- | ------------------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------- | ----------------------- |
| Bitcoin         | UTXO       | `https://mempool.space/api/blocks/tip/height` (tip probe)    | Blockstream tip REST                | Backend: **yes** (host + provider). Mobile Alchemy URLs: **no**                                            | Mobile: **preview only**. Backend: `getBalance` via `scantxoutset` when Alchemy live | Mobile: **preview synthetic**. Backend: get-by-hash; no full address history API wired like EVM transfers | **UI + preview submit** | **UI locked** (no QR/copy/share) | **No**                  |
| Ethereum        | EVM        | `https://ethereum.publicnode.com`                            | Cloudflare ETH, Ankr ETH            | Backend **yes**; mobile **yes** when keyed                                                                 | Mobile preview; backend `eth_getBalance`                                             | Mobile preview; backend `alchemy_getAssetTransfers` + getTransaction                                      | Preview send            | Locked                           | **No**                  |
| Solana          | Solana     | `https://api.mainnet-beta.solana.com`                        | `https://solana-rpc.publicnode.com` | Backend **yes**; mobile **yes** when keyed                                                                 | Mobile preview; backend `getBalance`                                                 | Mobile preview; backend getTransaction (no address-history helper like EVM)                               | Preview send            | Locked                           | **No**                  |
| BNB Smart Chain | EVM        | `https://bsc.publicnode.com`                                 | LlamaRPC, Ankr BSC                  | Backend **yes**; mobile **yes** when keyed                                                                 | Mobile preview; backend `eth_getBalance`                                             | Mobile preview; backend Enhanced transfers on EVM provider                                                | Preview send            | Locked                           | **No**                  |
| Tron            | Tron       | `https://api.trongrid.io`                                    | `https://tron-rpc.publicnode.com`   | Backend **yes**; mobile Alchemy URL: **no**                                                                | Mobile preview; backend balance via provider                                         | Mobile preview; backend getTransaction                                                                    | Preview send            | Locked                           | **No**                  |
| Polygon         | EVM        | `https://polygon-bor.publicnode.com`                         | polygon-rpc.com, Ankr Polygon       | Mobile Alchemy host **yes** when keyed; **backend not** in `ALCHEMY_SUPPORTED_CHAINS` / `ENABLED_MAINNETS` | Mobile preview only (no backend Alchemy Polygon)                                     | Mobile preview                                                                                            | Preview send            | Locked                           | **No**                  |
| Base            | —          | —                                                            | —                                   | **Not supported**                                                                                          | —                                                                                    | —                                                                                                         | —                       | —                                | —                       |
| Arbitrum        | —          | —                                                            | —                                   | **Not supported**                                                                                          | —                                                                                    | —                                                                                                         | —                       | —                                | —                       |
| Optimism        | —          | —                                                            | —                                   | **Not supported**                                                                                          | —                                                                                    | —                                                                                                         | —                       | —                                | —                       |

**Backend primary when local `.env` Alchemy key is loaded:** Alchemy for ETH, BSC, SOL, TRON, BTC (`BLOCKCHAIN_PRIMARY_PROVIDER=alchemy`, simulator false). Connectivity depends on key validity / Alchemy plan — not re-probed in this audit.

**RPC pool merge order (mobile):** explicit `*_RPC_URL` overrides → Alchemy (if key) → public defaults (`rpc_endpoints.dart`).

---

## 5. Market price configuration

### 5.1 Mobile (`PriceService`)

**Priority order (actual code — do not change):**

1. **CoinGecko** (`CoinGeckoMarketDataProvider`, id `coingecko`) — live HTTP; optional `COINGECKO_API_KEY`
2. **CoinCap** (`CoinCapMarketDataProvider`, id `coincap`) — live failover; optional Bearer `COINCAP_API_KEY`
3. **Seeded offline** (`SeededMarketDataProvider`, id `seeded-offline`) — built-in demo quotes (BTC/ETH/SOL/USDC/USDT/POL/BNB/TRX/AVAX)

Also:

- Cache: SharedPreferences + `CacheStore` (`auvora_price_cache_v1`), TTL ~45 minutes on namespaced write
- Flag: `ReleaseConfig.liveMarketPricesEnabled = true`
- **Alchemy Prices:** not used
- Bootstrap seeds from seeded provider if cache empty, then refreshes via failover chain

### 5.2 Backend (`services/market-data`)

- Primary: **CoinGecko** when `MARKET_DATA_SIMULATOR_ENABLED` is false
- Else: **simulator** market provider
- Optional `COINGECKO_API_KEY` / `COINGECKO_BASE_URL`
- Local root `.env` does **not** currently define `MARKET_DATA_SIMULATOR_ENABLED` or `COINGECKO_API_KEY` (service defaults from its own schema / compose may still apply)

---

## 6. Secret security audit

| Check                                           | Result                                                                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.env` / `.env.local` committed to Git?         | **No** — gitignored; `git ls-files` shows only `*.example` templates                                                                                                                                               |
| Hard-coded real Alchemy keys in tracked source? | **No** — only `$key` / `${key}` / fake test strings / `{key}` docs                                                                                                                                                 |
| Hard-coded Alchemy hostnames?                   | **Yes** (expected; not secrets)                                                                                                                                                                                    |
| Secrets logged?                                 | Redaction helpers: `RpcEndpoints.displayLabel`, `redactRpcUrl`, CoinGecko `redactUrl`; diagnostics expose booleans via `IntegrationConfig.readinessSummary()` (no values)                                          |
| Exposed in tests?                               | Placeholder strings only (`super-secret-key`, `test-key-123`)                                                                                                                                                      |
| Exposed in documentation?                       | Hostnames and `{key}` patterns; **no** live key values found in docs grep. Historical report notes prior plaintext sharing → **rotate**                                                                            |
| Bundled into release builds?                    | **Risk if** `--dart-define=ALCHEMY_API_KEY=…` used on Flutter release — key compiles into binary. Current defaults empty; no gradle hard-code of Alchemy found. Backend keys stay in env/Helm secrets (preferred). |
| `local.properties` secrets?                     | SDK paths only                                                                                                                                                                                                     |
| CI secret injection for Alchemy?                | Helm ExternalSecret **lists** `ALCHEMY_API_KEY`; GitHub workflow YAML **does not** reference it                                                                                                                    |

**Security issues to flag (no values revealed):**

1. **Local `.env` holds a nonempty `ALCHEMY_API_KEY`** — ensure it is the intended key; rotate if ever shared (per `ALCHEMY_INTEGRATION_REPORT.md`).
2. **Do not commit** populated `.env` or dart-define files with real keys.
3. **Avoid baking Alchemy keys into mobile APK** for production; prefer blockchain service proxy (`BLOCKCHAIN_SERVICE_URL`).
4. On-ramp **secret** keys must never go in client dart-defines (templates correctly call for publishable keys only).

---

## 7. New Alchemy integration plan (do **not** activate yet)

### 7.1 Preferred model: one central key

Use a **single** dedicated **Auvora Wallet** Alchemy application API key in:

| Priority                       | Variable              | Where to set                              | Role                                                   |
| ------------------------------ | --------------------- | ----------------------------------------- | ------------------------------------------------------ |
| **1 (canonical)**              | **`ALCHEMY_API_KEY`** | **`D:\auvora-wallet\.env`** (gitignored)  | Blockchain service constructs all enabled mainnet URLs |
| 2 (optional ops)               | Same name             | Helm / secrets manager → ExternalSecret   | Staging/production                                     |
| 3 (optional Alpha probes only) | Same name             | Flutter `--dart-define=ALCHEMY_API_KEY=…` | Mobile tip preference; **not** required for backend    |

Do **not** populate per-chain `ALCHEMY_*_RPC_URL` unless a chain needs a non-default URL. Empty overrides keep one-key construction.

**Exact local variable for the NEW key:**  
`ALCHEMY_API_KEY` in `D:\auvora-wallet\.env`

(Replace/rotate the existing PRESENT_SET value when introducing the new dedicated app key — **outside** this audit.)

### 7.2 Hostnames the key must unlock

Enable these networks on the Alchemy app so URL construction works:

| Network                           | Hostname                        | Consumer                                            |
| --------------------------------- | ------------------------------- | --------------------------------------------------- |
| Ethereum Mainnet                  | `eth-mainnet.g.alchemy.com`     | Backend + mobile                                    |
| BNB Smart Chain                   | `bnb-mainnet.g.alchemy.com`     | Backend + mobile                                    |
| Solana Mainnet                    | `solana-mainnet.g.alchemy.com`  | Backend + mobile                                    |
| Tron Mainnet                      | `tron-mainnet.g.alchemy.com`    | Backend (mobile uses public tip today)              |
| Bitcoin Mainnet                   | `bitcoin-mainnet.g.alchemy.com` | Backend (mobile uses Mempool/Blockstream tip today) |
| Polygon Mainnet (optional mobile) | `polygon-mainnet.g.alchemy.com` | Mobile only today                                   |

Constructed URL pattern: `https://<hostname>/v2/<ALCHEMY_API_KEY>`  
(Logged/redacted form: `https://<hostname>/v2/***REDACTED***`)

### 7.3 Related env (leave as-is until go-live)

- Keep `BLOCKCHAIN_PRIMARY_PROVIDER=alchemy`
- Keep `BLOCKCHAIN_SIMULATOR_ENABLED=false` for live backend reads
- Keep mobile `liveBroadcastEnabled=false` / `allowFundingAddresses=false` until security sign-off
- Verify with `node scripts/verify-alchemy-rpc.mjs` (redacts key) and `GET /health/providers` — **not run as part of this audit**

### 7.4 What not to do yet

- Do not enable live transaction broadcasting
- Do not flip funding receive unlocks
- Do not commit the new key
- Do not remove old host maps or unused override slots (they remain valid configuration surface)

---

## 8. Related documentation cross-check

| Doc                                                                                               | Relevance                                                                                |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `docs/API_AND_INTEGRATIONS_GUIDE.md`                                                              | Canonical mobile dart-define + provider matrix; matches code                             |
| `docs/ALCHEMY_CONFIGURATION.md`                                                                   | Backend env + URL resolution; accurate                                                   |
| `docs/ALCHEMY_INTEGRATION.md`                                                                     | Architecture rule (wallet never calls Alchemy directly)                                  |
| `docs/ALCHEMY_INTEGRATION_REPORT.md`                                                              | Prior live probe success claim; rotate-key note                                          |
| `docs/INTEGRATION_READINESS_AUDIT.md`                                                             | Earlier “no credentials in templates” — still true for git; local `.env` now has set key |
| `docs/RC1_SECURITY_AUDIT.md`                                                                      | Confirms kill switches; secrets scrubbing for Alpha                                      |
| `integration_config.dart` / `release_config.dart` / `network_manager.dart` / `price_service.dart` | Authoritative runtime behavior for mobile                                                |

---

## Appendix A — Mobile public RPC defaults (full URLs, no keys)

**Ethereum:** `https://ethereum.publicnode.com`, `https://cloudflare-eth.com`, `https://rpc.ankr.com/eth`  
**Polygon:** `https://polygon-bor.publicnode.com`, `https://polygon-rpc.com`, `https://rpc.ankr.com/polygon`  
**BSC:** `https://bsc.publicnode.com`, `https://binance.llamarpc.com`, `https://rpc.ankr.com/bsc`  
**Solana:** `https://api.mainnet-beta.solana.com`, `https://solana-rpc.publicnode.com`  
**Bitcoin (tip REST):** `https://mempool.space/api/blocks/tip/height`, `https://blockstream.info/api/blocks/tip/height`  
**Tron:** `https://api.trongrid.io`, `https://tron-rpc.publicnode.com`

---

## Appendix B — Audit constraints compliance

- Audit only; no credential or `.env` value changes
- No live broadcast enablement
- No secret values printed
- Only this file created/written: `docs/EXISTING_API_RPC_CONFIGURATION_AUDIT.md`
- No commit / push performed
