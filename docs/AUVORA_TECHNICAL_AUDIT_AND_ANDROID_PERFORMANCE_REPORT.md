# Auvora — Technical Audit & Android Performance Report

**Date:** 2026-08-02  
**Workspace:** `D:\auvora-wallet`  
**Authority:** Comprehensive health + Android performance audit. Low-risk fixes implemented. No commit/push. Live broadcast OFF. NFT absent. Funding kill switch safe.  
**Flutter PATH:** `C:\Users\kwasi\flutter\bin`

---

## 1. Issues discovered

| Area               | Finding                                                                                                                  | Severity                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| Android cold start | `main()` **awaited** Reown WalletKit init (up to **30s**) before `runApp`                                                | **Critical (perf)**           |
| Portfolio sync     | `NetworkManager.refresh()` ran **full tip probes** (6 chains × public/Alchemy RPC) on every `loadPortfolio`              | **High (perf)**               |
| Portfolio sync     | Network refresh and price bootstrap were **sequential** (up to ~14s + ~12s)                                              | **High (perf)**               |
| Market data        | `forceRefresh: true` after `bootstrap()` caused a **second** market provider round-trip                                  | **Medium (perf)**             |
| Chain sync         | Per-chain balances + history loaded **sequentially** across 6 chains                                                     | **Medium (perf)**             |
| Connectivity       | Offline DNS checks were sequential (`one.one.one.one` then `dns.google`)                                                 | **Low–Medium**                |
| RPC probes         | Solana tip probe issued **two** JSON-RPC calls (`getHealth` + `getLatestBlockhash`)                                      | **Low**                       |
| Gateway logging    | Redaction only covered `authorization` / `cookie` (missing CSRF, internal key, body tokens)                              | **Medium (security hygiene)** |
| Health (monorepo)  | Several services default simulators ON in local schemas; prod template sets OFF — Helm may not list simulator flags      | **Ops / debt**                |
| Health (monorepo)  | Swagger `/api/docs` always enabled on auth/gateway                                                                       | **Low (ops)**                 |
| Health             | SIGTERM shutdown handlers fire-and-forget without `.catch()`                                                             | **Low**                       |
| Not issues         | No hardcoded production secrets in source; CORS shared helper clean; web kill switches OFF; mobile broadcast/funding OFF | —                             |

---

## 2. Root causes of Android slowdown

Documented **before** optimizing (code-path / stopwatch instrumentation; device Timeline not captured this pass).

### R1 — WalletConnect blocked first frame (primary)

`main()` called `await WalletConnectBootstrap.create(...)` with a **30s** timeout before `runApp`. On devices with WC configured, Reown WalletKit + relay handshake delayed splash entirely.

### R2 — Tip RPC storm on portfolio critical path

`SyncEngine.loadPortfolio` always called `NetworkManager.refresh()` with tip probes enabled (`RPC_HEALTH_PROBE_ENABLED` default **true**). Six chains probed in parallel but still bounded by slowest RPC / failover (hard ceiling **12–14s**), and this ran **before** useful portfolio work completed.

### R3 — Sequential I/O waterfall

Critical path was roughly:

1. Tip probes (≤14s)
2. Price bootstrap (≤12s)
3. Forced price refresh again
4. Chain A balances → history → Chain B …

Wall time stacked; independent work did not overlap.

### R4 — Already mitigated (prior work, preserved)

- Wallet restore **12s** timeout on splash
- Portfolio cache-first paint
- Soft refresh timeouts (18–22s)
- SyncCoordinator coalesce / resume timeouts

These remain; this pass removes remaining head-of-line blockers **in front of** those gates.

### R5 — Secondary (not primary “feels slow”)

Splash animation (~900ms) is cosmetic and already reduced to ~80ms settle when motion allowed. Preview adapters are fast locally; **real** tip probes against public RPCs dominate on-device delay when probes were on the critical path.

---

## 3. Errors fixed

| Fix                                       | Notes                                                   |
| ----------------------------------------- | ------------------------------------------------------- |
| Deferred WC live init                     | First frame no longer waits on Reown                    |
| Portfolio path skips tip probes           | Connectivity-only refresh on sync critical path         |
| Parallel network + price bootstrap        | `Future.wait` with tighter timeouts (6s / 10s)          |
| Removed forced double price fetch         | `forceRefresh: false` after bootstrap                   |
| Parallel chain + in-chain balance fetches | Independent I/O overlapped                              |
| Parallel DNS offline detection            | Faster reachability decision                            |
| Solana tip probe                          | Single `getHealth` call                                 |
| Gateway Pino redaction                    | Aligned with auth (CSRF, internal key, password/tokens) |
| Analyzer / compile                        | `flutter analyze`: **No issues found**                  |

No crash-loop or restore-timeout regressions observed in tests.

---

## 4. Duplicate/dead code removed or consolidated

- **No large dead-code deletions** (dependents not fully proven for aggressive purge).
- WalletConnect bootstrap **API consolidated**: `previewShell` + `upgradeToLive` + blocking `create` for tests.
- CORS: confirmed **single** shared helper (`packages/security/src/cors-origins.ts`) — no duplicate modules to remove.
- Windows git path display (`/` vs `\`) is not duplicate source.

---

## 5. Performance optimizations implemented

| Change                                                   | File(s)                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| Instant WC preview shell; live upgrade after first frame | `wallet_connect_bootstrap.dart`, `main.dart`                |
| `_WcLiveUpgrader` + DeepLinkRouter `attachProvider`      | `main.dart`, `deep_link_router.dart`                        |
| `NetworkManager.refresh(probeEndpoints:)`                | `network_manager.dart`                                      |
| Deferred tip warm-up (~2s after coordinator start)       | `sync_coordinator.dart`                                     |
| Parallel sync + concurrent chain load                    | `sync_engine.dart`                                          |
| Parallel DNS                                             | `network_manager.dart`                                      |
| Solana probe slim                                        | `rpc_health_probe.dart`                                     |
| `StartupTiming` marks (debug / diagnostics JSON)         | `startup_timing.dart`, splash / wallet / home / sync export |
| New tests                                                | `test/startup_bootstrap_test.dart`                          |

**Not changed (by design):** secure storage restore, PIN/biometric, HD derivation, signing, broadcast kill switch, funding lock, Alchemy key injection rules.

---

## 6. API/blockchain optimizations

| Optimization                 | Detail                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Tip probes off critical path | Diagnostics still run via deferred warm-up + 45s health timer + resume           |
| Market dedupe                | One bootstrap refresh; sync quotes reuse cache unless stale / gap exceeded       |
| Chain concurrency            | All account chains load via `Future.wait`; balances per chain concurrent         |
| Timeouts                     | Connectivity 6s; price bootstrap 10s; tip probe ceiling remains 12s when enabled |
| Provider reuse               | SyncEngine still reused across Provider rebuilds                                 |

**Caution:** Cached portfolio / prices remain labeled via existing `fromCache` / `stale` / offline banners — no silent “fresh” claim for stale data.

---

## 7. Security issues discovered/corrected

| Item                             | Action                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Gateway log redaction incomplete | **Corrected** — mirror auth redact paths                                        |
| Live broadcast                   | Verified **OFF** (`ReleaseConfig.liveBroadcastEnabled = false`)                 |
| Funding addresses                | Verified **locked** (`allowFundingAddresses = false`)                           |
| Alchemy in APK                   | Unchanged — still via dart-define only; production guidance remains server-side |
| WC Project ID logging            | Still never logs value                                                          |
| Mnemonic binding for WC          | Unchanged; still gated on unlock / reveal                                       |
| Major crypto/auth architecture   | **Not modified** — escalate only if Lead wants further work                     |

**Escalate (recommend only):** production Swagger gate; Helm/explicit simulator flags in prod; device Timeline profile to confirm R1–R3 on hardware.

---

## 8. Files/components modified

### Mobile

- `apps/mobile/lib/main.dart`
- `apps/mobile/lib/connections/wallet_connect_bootstrap.dart`
- `apps/mobile/lib/connections/deep_link_router.dart`
- `apps/mobile/lib/wallet_engine/sync_engine.dart`
- `apps/mobile/lib/wallet_engine/sync_coordinator.dart`
- `apps/mobile/lib/wallet_engine/network_manager.dart`
- `apps/mobile/lib/wallet_engine/rpc_health_probe.dart`
- `apps/mobile/lib/reliability/startup_timing.dart` **(new)**
- `apps/mobile/lib/ui/splash_screen.dart`
- `apps/mobile/lib/ui/home_shell.dart`
- `apps/mobile/lib/state/wallet_controller.dart`
- `apps/mobile/test/startup_bootstrap_test.dart` **(new)**

### Backend hygiene

- `services/gateway/src/infrastructure/logging/logger.module.ts`

### Report

- `docs/AUVORA_TECHNICAL_AUDIT_AND_ANDROID_PERFORMANCE_REPORT.md` **(this file)**

---

## 9. Tests and builds performed

| Gate                               | Result                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `flutter analyze` (`apps/mobile`)  | **PASS** — No issues found (63.5s)                                            |
| `flutter test` (`apps/mobile`)     | **PASS** — **124** tests                                                      |
| Web `tsc --noEmit`                 | **PASS**                                                                      |
| Web `jest`                         | **PASS** — 10 suites, **24** tests                                            |
| Android APK rebuild                | **Not run** (compile verification via analyze + tests; optional APK deferred) |
| Device Timeline / DevTools profile | **Not run**                                                                   |
| Live Reown pairing on device       | **Not re-verified** this pass                                                 |
| Live Alchemy portfolio on device   | **Not re-verified** this pass                                                 |

---

## 10. Android performance before vs after (measurable)

Device wall-clock Timeline was **not** captured. Figures below are **code-path / bound** deltas (honest engineering estimates).

| Metric                                                | Before (code path)                                                         | After (code path)                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Time before `runApp` with WC configured               | Await Reown init (**0–30s**, timeout 30s → reduced to 20s on upgrade path) | **~0s** (preview shell); live init **after** first frame |
| Tip RPC calls on portfolio critical path              | Up to **6+** chains (failover multiplies)                                  | **0** on critical path; deferred ~2s later               |
| Solana tip probe RPCs                                 | **2** per successful URL                                                   | **1** (`getHealth`)                                      |
| Network + price on sync                               | Sequential ≤**14s + 12s**                                                  | Parallel ≤**max(6s, 10s)**                               |
| Market provider fetches per sync (typical warm cache) | Often **2** (bootstrap + forceRefresh)                                     | Typically **1**                                          |
| Chain balance/history                                 | Sequential across chains                                                   | Concurrent across chains + balances                      |
| Offline DNS detection                                 | Sequential ~2×2s worst                                                     | Parallel DNS                                             |
| `flutter analyze` issues                              | N/A this baseline                                                          | **0**                                                    |
| Mobile tests                                          | Prior leadership note ~17 focused; this suite                              | **124** PASS                                             |
| APK size                                              | Not rebuilt                                                                | N/A                                                      |

**StartupTiming marks** (debug / diagnostics export): `runApp`, `splashFirstFrame`, `walletRestoreDone`, `homeShellFirstFrame`, `homePortfolioBootstrapDone`, `wcLiveInitStart`, `wcLiveInitDone` — inspectable via Diagnostics JSON `startupTimingMs` on a debug build.

---

## 11. Anything that could not be verified

- Physical Android device “feels faster” subjective timing
- Flutter DevTools Timeline / CPU profiler on device
- APK size / R8 impact (APK not rebuilt)
- Live Reown session proposal / deep-link after deferred upgrade on hardware
- Production gateway/auth deploy + CORS against live web
- Alchemy live tip latency with real keys (probes deferred; adapters still preview in Alpha app wiring)
- Full monorepo turbo lint across all services

---

## 12. Remaining risks / tech debt

1. Deferred WC: deep link arriving in the first ~1–2s of cold start may hit preview provider until upgrade attaches — validateInboundUri should still work; live `pairUri` needs live relay.
2. Tip health banners may briefly show stale/empty until deferred probe completes (~2s + network).
3. Preview blockchain adapters still simulate balances — live chain adapters remain a Lead/engineering milestone.
4. Simulator defaults ON for several microservices locally; ensure prod secrets/Helm force OFF.
5. Swagger always on — gate behind env for production.
6. Gateway still calls `loadEnv()` at logger module import (side effect).
7. Aggressive UI rebuild reduction / list virtualization not audited deeply this pass (Home IndexedStack already keeps tabs alive).

---

## 13. Recommended next steps

1. **Device validation:** Sideload existing or new debug APK; confirm splash → unlock is snappy; watch logcat for `[AuvoraStartup]` marks; exercise WC pair after upgrade.
2. **Optional DevTools Timeline** on a mid-range Android device; attach numbers to §10.
3. **Lead Engineer:** Decide when to wire live (non-preview) balance adapters behind Alchemy/server proxy — do **not** bake `ALCHEMY_API_KEY` into release APK.
4. **Ops:** Align Helm/prod env simulator flags + Swagger disable.
5. **Product:** Keep broadcast OFF and funding locked until HD receive sign-off.
6. **Commit** only when Kwasi requests — this pass intentionally left uncommitted.

---

## Security invariants (re-verified)

| Invariant                             | Status                                        |
| ------------------------------------- | --------------------------------------------- |
| `ReleaseConfig.liveBroadcastEnabled`  | **false**                                     |
| `ReleaseConfig.allowFundingAddresses` | **false**                                     |
| NFT product surface                   | **Absent**                                    |
| No mnemonic/key logging added         | **Confirmed**                                 |
| WC Project ID not logged              | **Confirmed**                                 |
| Encrypted seed sync                   | **Not implemented** (design-only docs remain) |

---

**Commit / push:** NOT performed.
