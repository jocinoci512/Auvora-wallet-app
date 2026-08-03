# Auvora — Audit, Cleanup & Android Performance (Round 2)

**Date:** 2026-08-03  
**Workspace:** `D:\auvora-wallet`  
**Builds on:** `docs/AUVORA_TECHNICAL_AUDIT_AND_ANDROID_PERFORMANCE_REPORT.md` (2026-08-02) + `docs/FINAL_PRODUCTION_READINESS_REPORT.md`  
**Authority:** Project-wide health + Android performance. Prior sprint opts preserved. Low-risk wins implemented. No commit/push.  
**Flutter PATH:** `C:\Users\kwasi\flutter\bin`

---

## Prior sprint — verified still present

| Optimization                                                                         | Status     |
| ------------------------------------------------------------------------------------ | ---------- |
| Reown WalletKit deferred past `runApp` (`previewShell` + post-frame `upgradeToLive`) | **Intact** |
| Tip RPC probes off portfolio critical path (`probeEndpoints: false`)                 | **Intact** |
| Deferred tip warm-up (~2s) + 45s health timer                                        | **Intact** |
| Parallel network + price bootstrap in `loadPortfolio`                                | **Intact** |
| Parallel multi-chain sync + concurrent balances                                      | **Intact** |
| Parallel DNS offline race                                                            | **Intact** |
| Solana tip probe slimmed to `getHealth`                                              | **Intact** |
| `StartupTiming` marks                                                                | **Intact** |
| Cache-first portfolio paint + soft timeouts                                          | **Intact** |
| `liveBroadcastEnabled = false` / `allowFundingAddresses = false`                     | **Intact** |
| NFT product ABSENT (web + gateway 410)                                               | **Intact** |

---

## 1. Problems discovered

| Area                | Finding                                                                                                                                        | Severity                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Market data         | `PriceService.bootstrap()` always called `refreshQuotes` even with a **fresh non-seed disk cache** (`_lastRefreshAttemptAt` null bypassed gap) | **High (perf)** — Round 2 fixed                              |
| Resume path         | App resume awaited **full tip probes** (≤12s) before portfolio refresh                                                                         | **Medium (perf)** — Round 2 fixed                            |
| Chain sync          | Within each chain, history waited on balances (serial)                                                                                         | **Medium (perf)** — already parallelized in tree / confirmed |
| Sync I/O            | Prior portfolio cache loaded **after** network+price wait                                                                                      | **Low–Medium** — Round 2 overlaps cache read                 |
| Wallet restore      | SharedPreferences + vault bootstrap sequential                                                                                                 | **Low** — overlapped                                         |
| Analyzer            | Nullable `prior.transactions` after closure assignment                                                                                         | **Compile** — fixed                                          |
| Helm prod           | `CORS_ORIGINS` missing `app.` / `admin.`; simulator flags omitted (schemas default ON)                                                         | **Ops** — Round 2 pinned                                     |
| Helm prod           | `services.nft.enabled` still true in base chart                                                                                                | **Ops** — prod override `false`                              |
| Downstream services | Swagger `/api/docs` still ungated outside auth/gateway                                                                                         | **Ops debt** — documented only                               |
| Orphan web routes   | `/blockchain*`, `/custody*`, `/design-system`, etc. still live                                                                                 | **Debt** — documented only                                   |
| Env drift           | `.env.example` vs `.env.production.example` key gaps                                                                                           | **Debt** — documented only                                   |

---

## 2. Android slowdown causes (remaining + prior)

### Still relevant from Round 1 (mitigated, not eliminated)

- **R1** — Reown live init still runs after first frame (20s timeout). Can contend for CPU/network with portfolio soft sync; does **not** block splash.
- **R2** — Tip probes still run on deferred warm-up / health / resume diagnostics (off interactive critical path after Round 2 resume fix).
- **R4** — Secure vault restore + PIN/bio flags remain required before unlock UI (12s hard timeout). Correct and intentional.

### Round 2 root causes addressed

| ID     | Cause                                                                         | Mitigation                                                                  |
| ------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **R6** | Warm price cache still triggered CoinGecko→CoinCap→Alchemy on every bootstrap | Skip live refresh when non-seed cache within TTL; always refresh after seed |
| **R7** | Resume blocked on tip RPC storm before portfolio soft refresh                 | Connectivity-only first (`probeEndpoints: false`, 6s); tip warm after       |
| **R8** | Prior portfolio cache sequential after network/price                          | Load cache in same `Future.wait` as connectivity + price                    |
| **R9** | Prefs + vault restore sequential on splash                                    | Overlap `SharedPreferences.getInstance` with `engine.bootstrap()`           |

### Remaining (not fully removed)

- Connectivity DNS/HTTP on every portfolio sync (≤~2–5s worst when flaky) — accuracy preferred over skip.
- Preview adapters are fast; **live** balance adapters (when wired) will dominate wall time again.
- `ConnectionsController.bootstrap()` + prefs/intelligence fire at `MultiProvider` create — minor prefs contention.
- Splash cosmetic animation ~900ms (80ms settle when motion allowed) — cosmetic only.

---

## 3. Errors fixed

| Fix                                                      | Notes                                  |
| -------------------------------------------------------- | -------------------------------------- |
| Nullable `prior` promotion after closure assign          | `priorSnap` local — analyzer clean     |
| `prefer_const_constructors` on tx detail explorer labels | Info-level lint cleared                |
| Price bootstrap seed regression avoided                  | Seeded cache still forces live attempt |

No crash-loop or kill-switch regressions in tests.

---

## 4. Duplicate / unnecessary code found

- **No aggressive deletions** (dependents not fully proven).
- WalletConnect bootstrap API remains single module (`previewShell` / `upgradeToLive` / `create`).
- CORS remains single shared helper (`packages/security/src/cors-origins.ts`).
- NFT service code still in tree (product ABSENT via 410 + Helm disable) — leave until CTO purge decision.
- Dual portfolio persist (legacy key + CacheStore) retained for migration.

---

## 5. Performance optimizations implemented

| Change                                                    | File(s)                            |
| --------------------------------------------------------- | ---------------------------------- |
| Skip live market fetch on warm non-seed cache             | `price_service.dart`               |
| Resume: connectivity-only then deferred tip probes        | `sync_coordinator.dart`            |
| Parallel prior-cache + network + price in `loadPortfolio` | `sync_engine.dart`                 |
| Parallel balances + history within chain                  | `sync_engine.dart`                 |
| Overlap prefs + vault bootstrap                           | `wallet_controller.dart`           |
| Warm-cache skip unit test                                 | `test/startup_bootstrap_test.dart` |

**Not changed (by design):** secure storage, PIN/biometric, HD derivation, signing, broadcast kill switch, funding lock, Alchemy key injection.

---

## 6. API / blockchain optimizations

| Optimization                    | Detail                                                                    |
| ------------------------------- | ------------------------------------------------------------------------- |
| Market TTL respect on bootstrap | Warm coingecko/cached disk → **0** provider HTTP on critical path         |
| Seed path                       | Still attempts live providers after seed (honesty of prices)              |
| Resume tips                     | Off portfolio kickoff; diagnostics still warm afterward                   |
| Tip probes                      | Still deferred from soft sync; health timer unchanged                     |
| Helm simulators                 | Prod values pin `*_SIMULATOR_ENABLED=false` + `NFT_WORKERS_ENABLED=false` |

---

## 7. Files / components changed

### Mobile (Round 2)

- `apps/mobile/lib/wallet_engine/price_service.dart`
- `apps/mobile/lib/wallet_engine/sync_engine.dart`
- `apps/mobile/lib/wallet_engine/sync_coordinator.dart`
- `apps/mobile/lib/state/wallet_controller.dart` (prefs/vault overlap — verified)
- `apps/mobile/lib/ui/transaction_detail_screen.dart` (const lint)
- `apps/mobile/test/startup_bootstrap_test.dart`

### Ops

- `infrastructure/helm/auvora-wallet/values-production.yaml` — CORS app/admin, simulator pins, `services.nft.enabled: false`, `NFT_WORKERS_ENABLED`

### Report

- `docs/AUVORA_AUDIT_CLEANUP_ANDROID_PERF_REPORT.md` **(this file)**

---

## 8. Tests and builds run

| Gate                                                       | Result                                        |
| ---------------------------------------------------------- | --------------------------------------------- |
| `flutter analyze` (`apps/mobile`)                          | **PASS** — 0 errors (info lint cleared)       |
| `flutter test` (`apps/mobile`)                             | **PASS** — **126** tests                      |
| Focused: startup / reliability / wallet_engine / portfolio | **PASS**                                      |
| Android APK / AAB rebuild                                  | **Not run**                                   |
| Device Timeline / DevTools                                 | **Not run**                                   |
| Live Reown / Alchemy on device                             | **Not re-verified**                           |
| Web `tsc` / jest                                           | **Not re-run** this round (prior sprint PASS) |
| Helm template render                                       | **Not run**                                   |

---

## 9. Android before vs after (measurable)

Device wall-clock Timeline **not** captured. Code-path / bound deltas:

| Metric                                     | After Round 1                   | After Round 2                         |
| ------------------------------------------ | ------------------------------- | ------------------------------------- |
| Time before `runApp` (WC configured)       | ~0s preview shell               | **Unchanged** (preserved)             |
| Tip probes on portfolio critical path      | 0                               | **0** (preserved)                     |
| Tip probes before resume portfolio kickoff | Full refresh ≤12s               | **Connectivity only ≤6s**; tips after |
| Market HTTP on warm-cache bootstrap        | Often **1** full provider chain | **0** when non-seed TTL ok            |
| Market HTTP after empty-cache seed         | 1                               | **1** (intentional)                   |
| Prior portfolio cache vs network/price     | Sequential after                | **Parallel** with both                |
| In-chain balances → history                | Serial history after balances   | **Overlapped**                        |
| Prefs + vault restore                      | Sequential                      | **Overlapped**                        |
| Mobile tests                               | 124                             | **126** PASS                          |
| APK size / device ms                       | N/A                             | **Not measured**                      |

`StartupTiming` marks unchanged: `runApp`, `splashFirstFrame`, `walletRestoreDone`, `homeShellFirstFrame`, `homePortfolioBootstrapDone`, `wcLiveInitStart`, `wcLiveInitDone`.

---

## 10. Remaining problems

1. Physical device cold-start timing still unproven (need logcat `[AuvoraStartup]`).
2. Early deep link may hit preview WC until live upgrade attaches.
3. Tip health banners briefly empty until deferred probe.
4. Preview blockchain adapters — live adapters still Lead milestone (no Alchemy in APK).
5. Swagger ungated on most microservices; prod reject guards missing for swap/staking/bridge/connections/market-data/nft.
6. Orphan Alpha web routes still publicly routable.
7. Staging still has `NFT_WORKERS_ENABLED: true` in Helm staging values.
8. Domain cohesion (`wallet.auvora.app` vs `auvorawallet.com`) still open from production-readiness report.
9. Android upload keystore / Play Closed Testing still outstanding.

---

## 11. Could not verify

- Physical Android “feels faster” / Timeline ms
- APK size / R8
- Live Reown pair + `eth_sendTransaction` refuse on device
- Deployed Helm/External Secrets actually injecting simulator=false
- Runtime CORS against live `app.` / `admin.`
- Whether NFT pods run in any cluster
- Full monorepo turbo lint / all-service `tsc`

---

## 12. Major recommendations needing Lead Engineer / CTO approval

1. **Wire live (non-preview) balance/history adapters** behind server-side Alchemy — do **not** bake `ALCHEMY_API_KEY` into release APK.
2. **Canonical domain cutover** + Play listing / App Links alignment.
3. **Android upload signing** + Play App Signing.
4. **Purge or permanently disable NFT service** (code + Helm + gateway schema URL).
5. **Access JWT → httpOnly-only** / MFA login challenge — auth architecture, not a drive-by.
6. **CSP enforce** (still Report-Only).
7. **Prod schema guards** throwing when simulators ON (mirror payments/blockchain) for remaining services.
8. **Gate Swagger** on all services when `NODE_ENV=production`.

---

## 13. Recommended next step

1. Sideload debug APK; capture `[AuvoraStartup]` marks on a mid-range Android device.
2. Exercise unlock → Home cache paint → soft sync; confirm no CoinGecko storm when prices cached.
3. Exercise app resume; confirm portfolio refresh starts before tip probe completion.
4. Lead: schedule live adapter work + Play signing; keep broadcast OFF / funding locked.
5. **Commit only when Kwasi requests** — this pass intentionally uncommitted.

---

## Security invariants (re-verified)

| Invariant                             | Status                                |
| ------------------------------------- | ------------------------------------- |
| `ReleaseConfig.liveBroadcastEnabled`  | **false**                             |
| `ReleaseConfig.allowFundingAddresses` | **false**                             |
| NFT product surface                   | **ABSENT** (+ Helm prod nft disabled) |
| No mnemonic/key/Alchemy logging added | **Confirmed**                         |
| WC Project ID value not logged        | **Confirmed**                         |

---

**Commit / push:** NOT performed.
