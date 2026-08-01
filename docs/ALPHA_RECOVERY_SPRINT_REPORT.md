# Alpha Recovery Sprint Report

**Date:** 2026-07-31  
**Scope:** Closed Beta readiness — fix critical regressions; no new features; no redesign; no fake live rails  
**App:** `apps/mobile` · Version 1.0 Alpha (`1.0.0-alpha.1`)  
**Prior:** Stabilization Sprint 1 + 2 reports

Kill switches unchanged: `liveBroadcastEnabled = false`, `allowFundingAddresses = false`.

---

## Summary

| ID    | Issue                       | Verification                                              |
| ----- | --------------------------- | --------------------------------------------------------- |
| CI1   | Biometrics                  | **PARTIAL** (code-verified; no physical device)           |
| CI2   | Network sync                | **PARTIAL** (foreground sync verified; no OS WorkManager) |
| CI3   | Live market data            | **VERIFIED** (analyze/tests + CoinCap failover)           |
| CI4   | Activity history            | **VERIFIED** (root cause fixed + unit tests)              |
| CI5   | Buy providers               | **VERIFIED** (soft-gate strengthened)                     |
| CI6   | Languages                   | **VERIFIED** (English only)                               |
| CI7–9 | Buttons / forms / UI states | **PARTIAL** (critical-path audit; no redesign)            |
| CI10  | Real device testing         | **CANNOT WORK** (no adb/device on host)                   |
| CI11  | Performance                 | **PARTIAL** (tied fixes only)                             |
| CI12  | Security                    | **PARTIAL** (code audit; no device red-team)              |

**Hand to briefed Closed Beta testers?** **YES** — with Alpha caveats sheet (kill switches, preview adapters, foreground-only sync, biometric enrollment required).

---

## Phase 1 — Subsystem audit

| Subsystem               | Status                   | Notes                                                      |
| ----------------------- | ------------------------ | ---------------------------------------------------------- |
| Wallet Engine           | **Verified**             | HD derivation, secure key store, session unlock gate       |
| Portfolio               | **Verified** (after CI4) | Soft refresh + local activity persist/merge                |
| Market / prices         | **Verified**             | CoinGecko → CoinCap → seeded; stale banner                 |
| Blockchain adapters     | **Known gap**            | Preview adapters only until live broadcast unlock          |
| Network / sync          | **Partial**              | DNS+HTTPS probe, retries, resume/reconnect; no WorkManager |
| Auth (PIN / biometrics) | **Partial**              | FragmentActivity + enrollment checks; needs device retest  |
| Activity UI             | **Verified** (after CI4) | Watches portfolio; local txs no longer wiped by sync       |
| Buy / fiat              | **Gated (honest)**       | Auvora preview only; partners unavailable                  |
| Localization            | **Verified**             | `en` only; others Coming Soon / disabled                   |

---

## CI1 — Biometrics

### Root Cause

Sprint 1 fixed `FlutterFragmentActivity` and enrollment checks. Remaining gaps: unlock did not re-prompt after resume from background; enrollment-removed mid-session showed a vague error.

### Files Changed

- `apps/mobile/lib/ui/unlock_screen.dart`
- `apps/mobile/lib/state/wallet_controller.dart`
- (re-verified) `MainActivity.kt`, AndroidManifest `USE_BIOMETRIC` / `USE_FINGERPRINT`

### Fix Applied

- Unlock screen observes lifecycle and re-prompts biometrics on resume.
- Clearer unlock error when biometrics were enabled but are no longer enrolled.
- PIN remains always available; `authenticateForTransfer` still falls through to PIN.

### Testing Performed

- `flutter analyze lib test` — clean
- Code review of FragmentActivity + local_auth options
- **No physical biometric hardware available** (`adb` not on PATH)

### Verification Result

**PARTIAL** — implementation correct on paper; physical Android retest still required.

---

## CI2 — Network sync

### Root Cause

Sprint 1 restored HTTPS connectivity probe and stable SyncEngine. Gaps: resume refresh did not probe connectivity first; OS background sync still unwired (must not be faked).

### Files Changed

- `apps/mobile/lib/wallet_engine/sync_coordinator.dart`
- `apps/mobile/lib/ui/settings/diagnostics_screen.dart`
- (re-verified) `network_manager.dart`, `sync_engine.dart`, `portfolio_controller.dart`

### Fix Applied

- On app resume: `NetworkManager.refresh()` then portfolio soft refresh.
- Diagnostics copy clarifies foreground-only triggers + local activity merge.
- Retries/timeouts on ping and portfolio RPC paths retained.

### Testing Performed

- Analyze + full unit suite (incl. reliability / SyncEngine tests)
- No live multi-network device matrix

### Verification Result

**PARTIAL** — foreground sync path solid. **OS background sync CANNOT WORK** until WorkManager / BGTaskScheduler is wired. Missing: platform background task registration + worker that calls SyncEngine safely.

---

## CI3 — Live market data

### Root Cause

Single live provider (CoinGecko) → anonymous 429s fell straight to seeded quotes. Failover abstraction existed but only seeded was second.

### Files Changed

- `apps/mobile/lib/wallet_engine/coincap_market_data_provider.dart` _(new)_
- `apps/mobile/lib/wallet_engine/price_service.dart`

### Fix Applied

- Provider order: **CoinGecko → CoinCap → seeded**.
- Seeded marked stale only when live providers exist and failover lands on seed.
- `usingLiveProvider` true for CoinGecko **or** CoinCap.

### API keys (optional dart-define — never commit secrets)

```bash
flutter build apk --release --target-platform android-arm64 \
  --dart-define=COINGECKO_API_KEY=CG-... \
  --dart-define=COINCAP_API_KEY=...
```

CoinCap public quotes work without a key; key is optional Bearer auth.

### Testing Performed

- Analyze + `wallet_engine_test` price/history tests
- No live rate-limit soak on device

### Verification Result

**VERIFIED** (code + tests). Live HTTP success still depends on network/rate limits at runtime.

---

## CI4 — Activity history (HIGH PRIORITY)

### Root Cause

Device-created txs (`applyLocalSnapshot` from Send / Buy / Swap / etc.) updated **in-memory only** and were **not persisted**. On the next successful sync (`loadPortfolio`), adapter `getHistory()` returned only seeded preview receives and **replaced** the transaction list — wiping local activity. Resume / reconnect / pull-to-refresh made this look like “new transactions never appear.”

Kill switches were **not** the cause of local preview activity disappearing.

### Files Changed

- `apps/mobile/lib/portfolio/portfolio_controller.dart`
- `apps/mobile/lib/portfolio/portfolio_repository.dart`
- `apps/mobile/lib/wallet_engine/sync_engine.dart`
- `apps/mobile/lib/ui/send_flow_screen.dart`
- `apps/mobile/lib/engine/engine_controller.dart`
- `apps/mobile/test/activity_history_test.dart` _(new)_

### Fix Applied

1. Persist snapshot immediately after local activity (`applyLocalSnapshot` / finalize / record send).
2. Merge prior device txs by id into sync results (adapter wins on id collision).
3. Soft refresh also merges previous in-memory txs (race-safe).
4. Null-snapshot local apply bootstraps a minimal snapshot instead of silently dropping.

### Testing Performed

- New unit tests: merge keeps local ids; null-snapshot apply works
- Full suite: **101 passed**

### Verification Result

**VERIFIED** (logic + automated tests). Physical UI confirmation still recommended once a device is available.

---

## CI5 — Buy providers

### Root Cause

Partners looked selectable / “coming soon” without stating there is **no checkout/KYC/card charge**.

### Files Changed

- `apps/mobile/lib/ui/engine/digital_asset_flow.dart`
- `apps/mobile/lib/engine/quote_engine.dart`

### Fix Applied

- Banner: partners not connected — no checkout/KYC/card charge; Auvora preview only.
- Unavailable badge + stronger `unavailableReason`.
- Quotes still forced to `auvora-sim` for locked partners.

### Verification Result

**VERIFIED** (honest soft-gate). Live MoonPay/Ramp/Transak **CANNOT WORK** without partner API keys, redirect URLs, and KYC rails.

---

## CI6 — Languages

### Root Cause

N/A for new bugs — Sprint 1 clamp already in place.

### Files Changed

None required (re-audit only).

### Verification Result

**VERIFIED** — English ready; others Coming Soon / disabled; `setLocale` / `fromJson` clamp to `en`.

---

## CI7–9 — Buttons, forms, UI states

### Root Cause

Prior soft-gates left some Alpha-locked CTAs easy to misread as broken product.

### Files Changed

- Buy flow messaging (CI5)
- About / Diagnostics honesty copy
- Activity empty-state already Alpha-honest from Sprint 2

### Fix Applied

Critical-path audit only — no redesign. Dead partner rows remain non-interactive.

### Verification Result

**PARTIAL** — automated + code audit. Full manual click-through matrix needs a device.

---

## CI10 — Real device testing

### Root Cause

Host has no `adb` / no connected physical device or emulator in this environment.

### Testing Performed

```
flutter analyze lib test  → No issues found
flutter test              → All tests passed (101)
```

### Verification Result

**CANNOT WORK** on this host for interactive device QA.  
**How to complete:** Connect Android arm64 device, install recovery APK, smoke biometrics + send → Activity + pull-to-refresh prices + offline toggle.

---

## CI11 — Performance

### Fix Applied

Only tied fixes: stable SyncEngine reuse retained; activity persist avoids sync wipe/rebuild thrash; no speculative rewrite.

### Verification Result

**PARTIAL** — no profiler traces on device.

---

## CI12 — Security

### Verified

- PIN + biometrics gates; secure storage options intact
- Kill switches remain off
- Diagnostics export claims no secrets; clipboard guard + timeout prefs exist
- Send error paths strip mnemonic/private/seed from snackbars

### Gaps

- No instrumented leak scan on device
- Clipboard auto-clear depends on user prefs
- Preview adapters still simulate balances (product Alpha — not a secret leak)

### Verification Result

**PARTIAL**

---

## APK

| Field       | Value                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Path        | `D:\auvora-build\dist\alpha-1.0.0-recovery-sprint\auvora-wallet-1.0.0-alpha-recovery-sprint-release.apk` |
| Target      | `android-arm64`                                                                                          |
| Size        | ~41.0 MB (43,021,401 bytes)                                                                              |
| SHA-256     | `8490A271FFF6D7433BBD2ED6651966974287AFEF9618A782856E0FC301BD069F`                                       |
| Checksums   | `D:\auvora-build\dist\alpha-1.0.0-recovery-sprint\SHA256SUMS.txt`                                        |
| Gradle home | `D:\auvora-build\gradle-home`                                                                            |

---

## Remaining known issues

1. Live broadcast / funding still gated by design.
2. Balances / chain history still preview adapters (not mainnet RPC).
3. No OS WorkManager / BGTaskScheduler.
4. CoinGecko/CoinCap rate limits without optional dart-define keys.
5. Biometrics require enrolled hardware — not retested on device this sprint.
6. Buy/sell partners not live until rails + KYC.
7. WalletConnect remains local preview pairing.
8. Plugin KGP warning (`mobile_scanner`, `share_plus`) — build succeeds; track for Flutter Kotlin migration.

---

## Closed Beta recommendations

1. One physical Android smoke: biometrics unlock, preview send → Activity tab (no restart), pull-to-refresh prices, offline/online, Receive locked.
2. Brief testers: foreground-only sync; preview broadcast; funding locked; buy partners unavailable.
3. Optional demo CoinGecko key via CI dart-define (never commit).
4. Wire WorkManager before marketing “background sync.”
5. Keep kill switches until HD receive + broadcast audit sign-off.
6. **API / partner enablement:** follow [`API_AND_INTEGRATIONS_GUIDE.md`](./API_AND_INTEGRATIONS_GUIDE.md) and [`API_INTEGRATIONS_SPRINT_REPORT.md`](./API_INTEGRATIONS_SPRINT_REPORT.md).

---

## Confidence

**Hand to briefed Closed Beta testers? YES**

Rationale: CI4 activity wipe was a real product-breaking bug and is fixed with tests; market failover and honesty gates are stronger; analyze + 101 tests green; arm64 APK produced. Residual risk is device-specific biometrics/network and intentional Alpha kill switches — acceptable for a briefed closed cohort, not open store users.
