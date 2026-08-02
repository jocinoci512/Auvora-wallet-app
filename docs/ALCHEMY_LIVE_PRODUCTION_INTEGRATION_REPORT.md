# Auvora Wallet — Alchemy Live Production Integration Report

**Date:** 2026-08-02  
**Polygon re-verify:** 2026-08-02T18:47:39Z — MATIC_MAINNET enabled; Alchemy Polygon RPC **VERIFIED LIVE**  
**Workspace:** `D:\auvora-wallet`  
**Scope:** Production Alchemy activation & live read-only verification (15 phases)  
**Secret rule:** API key values never printed. RPC URLs shown as `…/v2/[REDACTED]`.  
**Git:** No commit / push performed. Root `.env` remains gitignored.

---

## Success criteria (strict)

| Field                            | Value                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **ALCHEMY CONFIGURED**           | **YES** (`ALCHEMY_API_KEY` present in gitignored root `.env`; `BLOCKCHAIN_PRIMARY_PROVIDER=alchemy`)              |
| **ALCHEMY AUTHENTICATED**        | **YES** (HTTP 200 + JSON-RPC results on ETH/Polygon/BSC/SOL/TRON/BTC; Prices API HTTP 200)                        |
| **ALCHEMY RPC VERIFIED LIVE**    | **YES** for ETH, Polygon, BSC, SOL, TRON, BTC                                                                     |
| **ALCHEMY PRICES VERIFIED LIVE** | **YES** (`symbols_priced=8/8` via Prices API)                                                                     |
| **PUBLIC RPC FAILOVER VERIFIED** | **YES** (ETH/Polygon/BSC/Solana public JSON-RPC; Blockstream BTC tip; TronGrid tip; Mempool.space flaky this run) |
| **SEND INFRASTRUCTURE READY**    | **YES** (UI + validation + fee + preview signing/broadcast path; live broadcast off)                              |
| **RECEIVE INFRASTRUCTURE READY** | **YES** behind kill switch (HD addresses; QR/copy/share locked by `allowFundingAddresses=false`)                  |
| **LIVE BROADCAST ENABLED**       | **NO** (`liveBroadcastEnabled=false` — must remain)                                                               |
| **ANDROID BUILD**                | **PASS**                                                                                                          |

---

## 1. Executive summary

The dedicated Auvora Wallet Alchemy key authenticates successfully for **six** mainnets (ETH, Polygon, BSC, SOL, TRON, BTC) plus the Prices API. Backend Alchemy includes **Polygon** in the shared EVM abstraction (URL builder + provider wiring; host `polygon-mainnet.g.alchemy.com`). **MATIC_MAINNET was enabled on the Auvora Wallet Alchemy app and re-verified live on 2026-08-02** (`eth_chainId` → `0x89`). Public Polygon RPC remains verified as failover. Mobile Alpha APK was built **without** baking `ALCHEMY_API_KEY` into dart-define. Kill switches remain off. Price order is CoinGecko → CoinCap → Alchemy Prices → last-known cache → seeded demo.

---

## 2. Credential validation (Phase 1)

| Check                                            | Result                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Key loaded from root `.env` via existing scripts | YES                                                                                        |
| Authenticated read-only RPC                      | VALID for ETH, Polygon, BSC, SOL, TRON, BTC                                                |
| Polygon Alchemy                                  | **VALID** (MATIC_MAINNET enabled; re-verified 2026-08-02 — HTTP 200, `eth_chainId`=`0x89`) |
| Rate limited                                     | Not observed                                                                               |
| Misconfigured                                    | No (key present and accepted on all six enabled networks)                                  |

Scripts: `scripts/verify-alchemy-rpc.mjs`, `scripts/verify-alchemy-live.mjs` (redact key path segments).

---

## 3. Network support matrix (Phase 2)

| NETWORK         | TYPE           | Alchemy API fit for Auvora needs  | Backend primary (when keyed) | Mobile tip pool                                       |
| --------------- | -------------- | --------------------------------- | ---------------------------- | ----------------------------------------------------- |
| Bitcoin         | Bitcoin / UTXO | YES (JSON-RPC tip/balance/fees)   | Alchemy                      | Alchemy (if dart-define) → Mempool → Blockstream REST |
| Ethereum        | EVM            | YES                               | Alchemy                      | Alchemy → PublicNode → Cloudflare → Ankr              |
| Solana          | Solana         | YES                               | Alchemy                      | Alchemy → Solana public → PublicNode                  |
| BNB Smart Chain | EVM            | YES                               | Alchemy                      | Alchemy → PublicNode → LlamaRPC → Ankr                |
| TRON            | TRON           | YES (Alchemy Tron tip + provider) | Alchemy                      | Alchemy → TronGrid → PublicNode                       |
| Polygon         | EVM            | YES (MATIC_MAINNET enabled)       | Alchemy                      | Alchemy → PublicNode → polygon-rpc → Ankr             |

Base / Arbitrum / Optimism: **not** added (out of scope).

---

## 4. Alchemy as preferred provider (Phase 3)

**Architecture:** Alchemy → Public #1 → Public #2 → graceful degrade.

- Backend: `createAlchemyProviders` + registry override when credentials exist.
- Mobile: `RpcEndpoints.urlsFor` merge order = overrides → Alchemy (if keyed) → public defaults.
- Public providers **retained** (PublicNode, Ankr, Cloudflare, Solana public, Mempool/Blockstream, TronGrid).
- Alpha APK: no client Alchemy key → public tip probes are effective primary on device; backend holds the server key.

---

## 5. Polygon backend wiring (Phase 4) — VERIFIED LIVE

| Change                     | Detail                                                                   |
| -------------------------- | ------------------------------------------------------------------------ |
| `ALCHEMY_SUPPORTED_CHAINS` | Includes `POLYGON`                                                       |
| Host                       | `polygon-mainnet.g.alchemy.com`                                          |
| Env                        | `ALCHEMY_POLYGON_RPC_URL` optional override                              |
| Provider                   | Reuses `AlchemyEvmProvider` with native symbol `POL`; primary when keyed |
| `ENABLED_MAINNETS`         | 6 (includes Polygon)                                                     |
| Chain ID probe             | `0x89` (137) — **VERIFIED LIVE**                                         |
| Live status                | **VERIFIED LIVE** after MATIC_MAINNET enabled (re-verified 2026-08-02)   |

---

## 6. Real RPC testing (Phase 5)

Recorded from `verify-alchemy-live.mjs` + Polygon deep probe (credentials redacted).  
**Polygon re-verify timestamp:** 2026-08-02T18:47:39Z (after MATIC_MAINNET enabled on Alchemy app).

| NETWORK  | PRIMARY PROVIDER | SUCCESS/FAIL | FALLBACK YES/NO                                                            | LATENCY RANGE                                                    |
| -------- | ---------------- | ------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Ethereum | Alchemy          | SUCCESS      | Public YES (~700ms)                                                        | Alchemy ~800–900ms                                               |
| Polygon  | Alchemy          | **SUCCESS**  | Public YES (PublicNode ~540–720ms); intentional bad-key Alchemy → HTTP 401 | Alchemy ~160–1120ms (gas/balance fast; chainId/block tip slower) |
| BSC      | Alchemy          | SUCCESS      | Public YES                                                                 | Alchemy ~900–1000ms                                              |
| Solana   | Alchemy          | SUCCESS      | Public YES                                                                 | Alchemy ~800–1000ms                                              |
| Bitcoin  | Alchemy          | SUCCESS      | Public YES (Blockstream); Mempool failed this run                          | Alchemy ~740–950ms                                               |
| TRON     | Alchemy          | SUCCESS      | Public YES (TronGrid)                                                      | Alchemy ~800–1000ms                                              |

### Polygon deep probe (Alchemy primary — read-only)

| Method                                       | Result                      | Latency     |
| -------------------------------------------- | --------------------------- | ----------- |
| `eth_chainId`                                | SUCCESS → `0x89` (137)      | ~505–1120ms |
| `eth_blockNumber`                            | SUCCESS (tip hex)           | ~620–730ms  |
| `eth_getBalance` (zero address)              | SUCCESS                     | ~210ms      |
| `eth_gasPrice`                               | SUCCESS                     | ~160ms      |
| `eth_maxPriorityFeePerGas`                   | SUCCESS                     | ~180ms      |
| `eth_feeHistory`                             | SUCCESS                     | ~240ms      |
| PublicNode `eth_blockNumber` / `eth_chainId` | SUCCESS (`0x89`)            | ~540–720ms  |
| Alchemy invalid key (failover prove)         | FAIL as expected (HTTP 401) | ~200ms      |

---

## 7. Alchemy Prices fallback (Phase 6)

**Order:** CoinGecko → CoinCap → Alchemy Prices → last-known cached → seeded/demo.

| Item                         | Status                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Mobile provider              | `alchemy_prices_market_data_provider.dart`                                        |
| Live Prices API              | VERIFIED (`8/8` symbols)                                                          |
| Timeouts / 429 / auth errors | Thrown → failover                                                                 |
| Dedup / hammer guard         | `_minRefreshGap` 20s on `PriceService`                                            |
| Last-known persistence       | SharedPreferences + `CacheStore` TTL ~45m                                         |
| Seeded                       | Only after live providers fail / empty cache; marked `stale`                      |
| Alpha APK                    | Alchemy Prices **inactive** (no dart-define key) — CoinGecko/CoinCap/cache/seeded |

---

## 8. Real-time price UX (Phase 7)

| Trigger         | Behavior                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------ |
| Initial         | `PriceService.bootstrap` + sync start refresh                                              |
| Pull-to-refresh | Portfolio refresh → quote refresh                                                          |
| App resume      | `SyncCoordinator` resume refresh                                                           |
| Periodic        | Health/pending ticks; price refreshInterval ~2m (polling, **not** streaming)               |
| UI              | Home banners distinguish live vs stale/cached/demo; Diagnostics shows provider + freshness |

Terminology: UI copy uses “poll / pull to refresh”, not “streaming”.

---

## 9. Mobile secret security (Phase 8)

| Topic                | Decision                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Server key           | Root `.env` `ALCHEMY_API_KEY` for blockchain service only                                                               |
| APK dart-define      | **Not injected** for this Alpha build                                                                                   |
| Extractable from APK | Public RPC hostnames; empty Alchemy key slot; no production Alchemy secret compiled in                                  |
| Prefer proxy         | Backend/market-data should own Prices/Data keys; mobile provider activates only if a **dev** dart-define key is present |
| Docs                 | `integration_config.dart` + `ALCHEMY_CONFIGURATION.md` warn against release dart-define                                 |

---

## 10. Send readiness (Phase 9)

| Capability                             | Status                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------- |
| Address validation                     | Present (chain rules)                                                  |
| Fees / construction / signing pipeline | Preview path via `TransactionEngine` + adapters                        |
| Broadcast                              | Preview only (`broadcastPreviewMessage`; `liveBroadcastEnabled=false`) |
| Confirmation / Activity                | Local pending txs + merge                                              |
| Real funds sent                        | **NO** (not performed)                                                 |

---

## 11. Receive readiness (Phase 9)

| Capability                 | Status                                     |
| -------------------------- | ------------------------------------------ |
| HD address derivation      | Active (`bip32Partial`)                    |
| QR / copy / share          | **Locked** (`allowFundingAddresses=false`) |
| Architecture behind switch | Ready; unlock requires explicit sign-off   |
| Balance monitoring         | Preview adapters + tip health probes       |

---

## 12. Activity pipeline (Phase 10)

| Check                          | Result                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------- |
| Device-local merge across sync | YES — `SyncEngine` keeps prior txs; `PortfolioController.mergeDeviceActivity` |
| Tests                          | `activity_history_test.dart`, `session_restore_timeout_test.dart` passed      |
| RPC refresh wiping pending     | Mitigated by merge (verified by tests)                                        |

---

## 13. Provider diagnostics (Phase 11)

Diagnostics screen (no secrets):

- Per-network RPC: Connected / Degraded / Offline + latency + redacted endpoint + failover count
- Price provider label (CoinGecko / CoinCap / Alchemy Prices / Demo / Cached)
- Price freshness age
- Alchemy client key boolean (present/absent) — not the value
- Integrations readiness booleans only

---

## 14. Alchemy dashboard visibility (Phase 12)

`scripts/alchemy-dashboard-traffic.mjs` issued **18** legitimate read-only probes (3 rounds × 5 RPC chains + Prices). **18/18 OK**. Not a load test.

---

## 15. Regression testing (Phase 13)

| Suite                                                                       | Result                   |
| --------------------------------------------------------------------------- | ------------------------ |
| `flutter analyze lib test`                                                  | No issues found          |
| `flutter test`                                                              | **109 passed**           |
| Blockchain Jest (`alchemy-rpc` / `blockchain.config` / `alchemy.providers`) | **18 passed**, 1 skipped |
| Web `tsc --noEmit`                                                          | PASS                     |

---

## 16. Android Alpha build (Phase 14)

| Field                   | Value                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| Path                    | `D:\auvora-build\dist\alchemy-live-alpha\auvora-wallet-alchemy-live-alpha.apk` |
| Size                    | 43,086,937 bytes (~41.1 MB)                                                    |
| SHA-256                 | `1d3851afac5a9a33a2905c73e63b504ef4ad941e0700186e58c5a99596e53426`             |
| Version                 | `1.0.0-alpha.1+5`                                                              |
| Signing                 | Android **Debug** keystore (`CN=Android Debug`)                                |
| dart-define Alchemy key | **Not injected**                                                               |
| Prior known-good        | Not overwritten (new dist folder)                                              |

---

## 17. Kill switches (confirmed)

| Flag                                  | Value   |
| ------------------------------------- | ------- |
| `ReleaseConfig.liveBroadcastEnabled`  | `false` |
| `ReleaseConfig.allowFundingAddresses` | `false` |

---

## 18. Files changed (this sprint)

**Backend**

- `services/blockchain/src/infrastructure/providers/alchemy/alchemy-rpc.config.ts`
- `services/blockchain/src/infrastructure/providers/alchemy/alchemy-rpc.config.spec.ts`
- `services/blockchain/src/infrastructure/providers/alchemy/create-alchemy-providers.ts`
- `services/blockchain/src/infrastructure/providers/alchemy/alchemy.providers.integration.spec.ts`
- `services/blockchain/src/infrastructure/providers/multi-chain-provider.manager.ts`
- `services/blockchain/src/config/blockchain.config.ts`
- `services/blockchain/src/config/blockchain.config.spec.ts`
- `services/blockchain/src/config/env.schema.ts`

**Mobile**

- `apps/mobile/lib/wallet_engine/alchemy_prices_market_data_provider.dart` _(new)_
- `apps/mobile/lib/wallet_engine/price_service.dart`
- `apps/mobile/lib/wallet_engine/rpc_endpoints.dart`
- `apps/mobile/lib/wallet_engine/rpc_health_probe.dart`
- `apps/mobile/lib/release/integration_config.dart`
- `apps/mobile/lib/release/release_config.dart`
- `apps/mobile/lib/ui/home/home_tab.dart`
- `apps/mobile/lib/ui/settings/diagnostics_screen.dart`
- `apps/mobile/test/integration_config_test.dart`

**Scripts / docs / env template**

- `scripts/verify-alchemy-rpc.mjs`
- `scripts/verify-alchemy-live.mjs` _(new)_
- `scripts/alchemy-dashboard-traffic.mjs` _(new)_
- `docs/ALCHEMY_CONFIGURATION.md`
- `.env.example` (`ALCHEMY_POLYGON_RPC_URL`)
- `docs/ALCHEMY_LIVE_PRODUCTION_INTEGRATION_REPORT.md` _(this file)_

---

## 19. Blockers / NOT VERIFIED / next ops steps

1. ~~Enable Polygon (MATIC_MAINNET)~~ — **DONE.** Re-verified live 2026-08-02 (`eth_chainId` → `0x89`; balance/gas/feeHistory OK). All six Alchemy RPC networks are **VERIFIED LIVE**.
2. Mobile Alpha still uses **preview** chain adapters for balances/history — live RPC tips are diagnostics-only until live adapters are audited.
3. Optional: wire a backend market-data **proxy** for Alchemy Prices so mobile never needs a client key.
4. Mempool.space tip probe failed once this session; Blockstream fallback succeeded — keep both.
5. Do **not** enable `liveBroadcastEnabled` or `allowFundingAddresses` without security sign-off.

---

## Appendix — Security attestations

- No secrets printed in this report or script output (redacted URLs only).
- `.env` not committed (`git check-ignore` confirms).
- No `git commit` / `git push` performed for this sprint.
