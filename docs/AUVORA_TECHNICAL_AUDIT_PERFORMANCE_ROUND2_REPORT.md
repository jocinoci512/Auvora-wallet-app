# Auvora — Technical Audit & Performance Round 2 Report

**Date:** 2026-08-03  
**Workspace:** `D:\auvora-wallet`  
**Authority:** Round 2 — build on Round 1 (deferred Reown, deferred tip probes, parallel sync/prices). New remaining bottlenecks only. Low-risk fixes implemented. No commit/push. Live broadcast OFF. NFT absent. Funding kill switch safe.  
**Flutter PATH:** `C:\Users\kwasi\flutter\bin`  
**Prior reports:** [`AUVORA_TECHNICAL_AUDIT_AND_ANDROID_PERFORMANCE_REPORT.md`](./AUVORA_TECHNICAL_AUDIT_AND_ANDROID_PERFORMANCE_REPORT.md), [`FINAL_PRODUCTION_READINESS_REPORT.md`](./FINAL_PRODUCTION_READINESS_REPORT.md)

---

## 1. Issues discovered

| Area                | Finding                                                                                                                                   | Severity                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Wallet restore      | `SecureKeyStore` re-ran legacy migration checks and re-read vault index / active id on every `listVaults` / `readWallet` / `readMnemonic` | **High (perf)**                |
| Wallet restore      | `WalletEngine.bootstrap` awaited vault list → wallet → mnemonic **sequentially** (multiplied keystore I/O)                                | **High (perf)**                |
| Wallet restore      | `SharedPreferences.getInstance` awaited **before** vault restore (independent I/O stacked)                                                | **Medium (perf)**              |
| Wallet restore      | PIN / bio / address secure reads were sequential                                                                                          | **Medium (perf)**              |
| Connectivity        | Dual DNS used `Future.wait` — waited for the **slower** lookup even after first success                                                   | **Medium (perf)**              |
| Chain sync          | Per-chain **history** still ran after balances (not overlapped)                                                                           | **Medium (perf)**              |
| UI rebuild          | `buildAetherTheme` (GoogleFonts) ran on **every** `PreferencesController` notify                                                          | **Medium (perf)**              |
| Market map          | `PriceService.quotes` awaited `quote()` per symbol (N microtasks after warm cache)                                                        | **Low (perf)**                 |
| RPC probes          | New `HttpClient` per URL attempt inside a chain probe (deferred path, still wasteful)                                                     | **Low (perf)**                 |
| Home banners        | `context.watch<PriceService>()` on a non-`ChangeNotifier` (misleading; no live ticks)                                                     | **Low (hygiene)**              |
| Round 1 regressions | Deferred WC, `probeEndpoints: false` on portfolio path, parallel network+prices, chain concurrency, Solana single `getHealth`             | **None — re-verified present** |

Not issues this pass: hardcoded secrets, broadcast/funding unlock, NFT surface, aggressive dead-code deletion.

---

## 2. Root causes of remaining Android slowdown

Code-path analysis (device Timeline **not** captured this round). Round 1 removed head-of-line WC + tip storms; Round 2 targets what still sits on **splash → unlock** and **first portfolio fill**.

### R6 — Secure storage I/O amplification on restore (primary remaining)

Cold restore called migration + index + active id repeatedly across three APIs. On Android `EncryptedSharedPreferences` / Keystore, each read is non-trivial. Sequential `WalletEngine.bootstrap` stacked that cost.

### R7 — Independent restore I/O still sequential

Prefs load and vault restore do not depend on each other; PIN/bio/address flag reads do not depend on each other. They were awaited in series.

### R8 — Connectivity race incomplete

Round 1 parallelized DNS but still waited for both lookups. Online devices paid `max(dnsA, dnsB)` instead of `min` on first success — still on every connectivity-only portfolio refresh.

### R9 — Within-chain history waterfall

Cross-chain concurrency existed; within a chain, history waited for all balances.

### R10 — Theme / GoogleFonts rebuild tax

Any prefs notify rebuilt light+dark `ThemeData` via GoogleFonts — expensive vs reusing cached themes when accent/a11y unchanged.

### Preserved Round 1 mitigations (still critical)

- WC preview shell before `runApp`; live upgrade post-frame
- Tip probes off portfolio critical path; deferred ~2s warm-up
- Parallel connectivity + price bootstrap; no forced double market fetch
- Parallel chains + StartupTiming marks

---

## 3. Errors fixed

| Fix                                                    | Notes                                             |
| ------------------------------------------------------ | ------------------------------------------------- |
| Keystore migration lock + in-memory index/active cache | Concurrent-safe; writes invalidate/update cache   |
| Parallel vault/wallet/mnemonic after `ensureReady()`   | Restore I/O overlapped                            |
| Overlap SharedPreferences with engine bootstrap        | Splash path shorter wall time                     |
| Parallel PIN/bio/(address) secure reads                | Fewer serial Keystore round-trips                 |
| DNS first-success race                                 | Online path returns on first good resolver        |
| Overlap balances + history per chain                   | Sync critical path shorter                        |
| Theme cache keyed by a11y + accent                     | Avoid GoogleFonts rebuild storms                  |
| Sync quote map from warm cache                         | No N× await after bootstrap                       |
| Reuse HttpClient across URLs in one probe              | Deferred tip warm-up cheaper                      |
| Home banner uses `read` for PriceService               | Correct Provider usage                            |
| Analyzer                                               | Exit 0 — 2 pre-existing `prefer_const` infos only |

No crash-loop or restore-timeout regressions in tests. Security gates unchanged.

---

## 4. Duplicate/dead code removed or consolidated

- **No large dead-code deletions** (dependents not fully proven).
- Price quote path consolidated into `_quoteFromCache` (single stale/age policy).
- RpcHealthProbe no longer opens/closes a client per URL in a chain probe.
- Round 1 WC API (`previewShell` / `upgradeToLive`) left intact.

---

## 5. Performance optimizations implemented

| Change                                      | File(s)                            |
| ------------------------------------------- | ---------------------------------- |
| Migration once + index/active memory cache  | `key_store.dart`                   |
| Parallel keystore reads in engine bootstrap | `wallet_engine.dart`               |
| Overlap prefs + vault; parallel auth flags  | `wallet_controller.dart`           |
| DNS race (`_anyDnsReachable`)               | `network_manager.dart`             |
| Per-chain balances ∥ history                | `sync_engine.dart`                 |
| Shared HttpClient per probe()               | `rpc_health_probe.dart`            |
| ThemeData cache in app state                | `main.dart`                        |
| Batch quotes from cache                     | `price_service.dart`               |
| Banner `read` hygiene                       | `home_tab.dart`                    |
| Extra bootstrap test for quote batch        | `test/startup_bootstrap_test.dart` |

**Not changed (by design):** secure encryption model, PIN hashing, HD derivation, signing, broadcast kill switch, funding lock, Alchemy dart-define injection rules, live chain adapters.

---

## 6. API/blockchain optimizations

| Optimization                          | Detail                                                             |
| ------------------------------------- | ------------------------------------------------------------------ |
| Round 1 tip probes off critical path  | **Re-verified** — still `probeEndpoints: false` in `loadPortfolio` |
| Within-chain history overlap          | History no longer strictly after balances                          |
| DNS race on connectivity-only refresh | Faster offline detection for sync gate                             |
| Quote assembly                        | Post-bootstrap map is sync from memory                             |
| Probe client reuse                    | Fewer sockets on deferred 6-chain warm-up                          |

Cached / stale / offline honesty flags unchanged — no silent “fresh” claims.

---

## 7. Security issues discovered/corrected

| Item                           | Action                                                             |
| ------------------------------ | ------------------------------------------------------------------ |
| Live broadcast                 | Re-verified **OFF** (`ReleaseConfig.liveBroadcastEnabled = false`) |
| Funding addresses              | Re-verified **LOCKED** (`allowFundingAddresses = false`)           |
| NFT                            | Still absent (prior readiness report)                              |
| Mnemonic / PIN / keys          | No logging added; parallel reads do not weaken storage             |
| WC Project ID                  | Still never logged as value                                        |
| Alchemy in APK                 | Unchanged — dart-define only; do not bake release key              |
| Major crypto/auth architecture | **Not modified**                                                   |

**Escalate (recommend only):** device Timeline numbers for R6–R10; live (non-preview) balance adapters behind server proxy; domain cohesion / Play signing from readiness report.

---

## 8. Files/components modified

### Mobile

- `apps/mobile/lib/wallet_engine/key_store.dart`
- `apps/mobile/lib/wallet_engine/wallet_engine.dart`
- `apps/mobile/lib/state/wallet_controller.dart`
- `apps/mobile/lib/wallet_engine/network_manager.dart`
- `apps/mobile/lib/wallet_engine/sync_engine.dart`
- `apps/mobile/lib/wallet_engine/rpc_health_probe.dart`
- `apps/mobile/lib/wallet_engine/price_service.dart`
- `apps/mobile/lib/main.dart`
- `apps/mobile/lib/ui/home/home_tab.dart`
- `apps/mobile/test/startup_bootstrap_test.dart`

### Report

- `docs/AUVORA_TECHNICAL_AUDIT_PERFORMANCE_ROUND2_REPORT.md` **(this file)**

---

## 9. Tests and builds performed

| Gate                                               | Result                                             |
| -------------------------------------------------- | -------------------------------------------------- |
| `flutter analyze --no-fatal-infos` (`apps/mobile`) | **PASS** — exit 0; 2 `prefer_const` infos          |
| `flutter test` (`apps/mobile`)                     | **PASS** — **125** tests (was 124 + 1 quote batch) |
| Web `tsc --noEmit`                                 | **PASS**                                           |
| Web `jest`                                         | **PASS** — 10 suites, **24** tests                 |
| Android APK / AAB                                  | **Not run**                                        |
| Device Timeline / DevTools                         | **Not run**                                        |
| Live Reown / Alchemy on hardware                   | **Not re-verified**                                |

---

## 10. Android performance before vs after (measurable)

Device wall-clock Timeline **not** captured. Figures are **code-path / bound** deltas on top of Round 1.

| Metric                               | After Round 1                                                   | After Round 2 (this pass)                            |
| ------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------- |
| Time before `runApp` (WC configured) | ~0s (preview shell)                                             | **Unchanged** (~0s)                                  |
| Tip RPCs on portfolio critical path  | 0                                                               | **Unchanged** (0)                                    |
| WalletEngine keystore ops on restore | Sequential list→wallet→mnemonic + repeated migrate/index/active | **1 migrate + parallel reads + cached index/active** |
| Prefs vs vault restore               | Sequential                                                      | **Overlapped**                                       |
| PIN/bio/(address) secure reads       | 2–3 sequential                                                  | **1 parallel batch**                                 |
| DNS online decision                  | `max(dnsA, dnsB)` via `Future.wait`                             | **`min` on first success** (race)                    |
| Per-chain history vs balances        | Sequential after balances                                       | **Overlapped**                                       |
| Theme rebuild on prefs notify        | Always rebuild GoogleFonts themes                               | **Cached** unless accent/a11y change                 |
| Quote map after warm cache           | N× `await quote`                                                | **Sync map**                                         |
| Probe HttpClient per URL             | New client each URL                                             | **One client per chain probe**                       |
| `flutter test` count                 | 124                                                             | **125 PASS**                                         |
| APK size                             | N/A                                                             | N/A (not rebuilt)                                    |

**StartupTiming marks** (unchanged set): `runApp`, `splashFirstFrame`, `walletRestoreDone`, `homeShellFirstFrame`, `homePortfolioBootstrapDone`, `wcLiveInitStart`, `wcLiveInitDone`.

---

## 11. Anything that could not be verified

- Physical Android “feels faster” / logcat `[AuvoraStartup]` wall times
- Flutter DevTools Timeline on mid-range hardware
- APK size / R8 impact
- Live Reown deep-link in first seconds after deferred upgrade
- Live Alchemy tip latency with real keys
- Full monorepo turbo lint / all services

---

## 12. Remaining risks / tech debt

1. Deferred WC: deep link in first ~1–2s may still hit preview until live attach (Round 1 debt).
2. Tip health banners may briefly look empty until deferred probe (~2s).
3. Preview blockchain adapters still simulate balances — live adapters are a Lead milestone.
4. IndexedStack still builds all four home tabs (intentional keep-alive; memory vs rebuild trade-off).
5. Send-flow screens use non-builder `ListView` for short step forms — fine at current size.
6. `SecureKeyStore` cache is process-local — correct; multi-isolate writers not in scope.
7. Production readiness items remain: domain cohesion, upload keystore, device verification, legal hosts.

---

## 13. Recommended next steps

1. **Device validation:** Debug APK; logcat `[AuvoraStartup]` marks; confirm splash → unlock snappiness after R6–R7.
2. **Optional Timeline** attach numbers to §10 for restore + first sync.
3. **Lead Engineer:** Wire live balance adapters behind Alchemy/server proxy — do **not** bake `ALCHEMY_API_KEY` into release APK.
4. **Play Closed Testing:** Domain cutover, upload signing, hosted legal (see readiness report).
5. **Keep** broadcast OFF and funding locked until HD receive sign-off.
6. **Commit** only when Kwasi requests — this pass intentionally left uncommitted.

---

## Round 1 re-verification checklist

| Optimization                                                      | Still present? |
| ----------------------------------------------------------------- | -------------- |
| `WalletConnectBootstrap.previewShell` before `runApp`             | **Yes**        |
| Post-frame `upgradeToLive` + `_WcLiveUpgrader`                    | **Yes**        |
| `NetworkManager.refresh(probeEndpoints: false)` on portfolio path | **Yes**        |
| Deferred tip warm-up (~2s) in `SyncCoordinator`                   | **Yes**        |
| Parallel network refresh + price bootstrap                        | **Yes**        |
| `forceRefresh: false` after bootstrap                             | **Yes**        |
| Parallel chain loads                                              | **Yes**        |
| Solana tip = single `getHealth`                                   | **Yes**        |
| `StartupTiming` gated diagnostics                                 | **Yes**        |

---

## Security invariants (re-verified)

| Invariant                             | Status                    |
| ------------------------------------- | ------------------------- |
| `ReleaseConfig.liveBroadcastEnabled`  | **false**                 |
| `ReleaseConfig.allowFundingAddresses` | **false**                 |
| NFT product surface                   | **Absent** (prior sprint) |
| No mnemonic/key logging added         | **Confirmed**             |
| WC Project ID not logged as value     | **Confirmed**             |
| Encrypted seed sync                   | **Not implemented**       |

---

**Commit / push:** NOT performed.
