# Alpha Stabilization Sprint 2 Report

**Date:** 2026-07-31  
**Scope:** Quality over features — verify Sprint 1, eliminate misleading UX, polish trust/transparency, light performance, closed-beta readiness check  
**App:** `apps/mobile` · Version 1.0 Alpha (`1.0.0-alpha.1`)  
**Prior APK:** `D:\auvora-build\dist\alpha-1.0.0-stabilization-sprint-1\`

Kill switches unchanged: `liveBroadcastEnabled = false`, `allowFundingAddresses = false`.

---

## Summary

Sprint 1 P0/P1/P2 fixes remain in place (code + analyze + automated tests). Sprint 2 closed trust gaps where Alpha gates still looked like broken product (empty Home “Receive crypto” CTA, unlabelled Sell/Bridge/Stake, stale asset-detail price copy, missing background-sync honesty). Release APK rebuilt for arm64.

**Hand to 100 alpha testers?** **YES** — with Alpha-honest caveats (preview broadcast, locked funding, no OS background sync, CoinGecko rate limits).

---

## Phase 1 — Sprint 1 verification evidence

| Issue             | Status                                                    | Evidence                                                                                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Biometrics**    | **VERIFIED** (code + analyze; device retest still needed) | `MainActivity` extends `FlutterFragmentActivity`. `canCheckBiometrics()` requires device support + enrolled biometrics. Unlock auto-prompts + PIN always available (`unlock_screen.dart`). PlatformException mapped; `authenticateForTransfer` falls through to PIN. |
| **Network sync**  | **VERIFIED**                                              | `NetworkManager._detectOffline`: DNS then HTTPS `connectivitycheck.gstatic.com/generate_204`. Preview adapter `ping()` always healthy. `main.dart` reuses single `SyncEngine` / `PortfolioRepository`. Home surfaces `lastSyncError` + Retry.                        |
| **Live prices**   | **VERIFIED**                                              | Sync calls `quotes(..., forceRefresh: true)`. CoinGecko throws on non-200/429/empty; User-Agent set. Seeded failover marks `stale: true`. Home banner: live prices unavailable + Retry.                                                                              |
| **Buy providers** | **VERIFIED**                                              | Soft-gate banner in buy configure; MoonPay/Ramp/Transak `available: false`, “Coming soon”, non-interactive. Tests assert locked partners + non-empty `unavailableReason`.                                                                                            |
| **Language**      | **VERIFIED**                                              | English-only chips enabled; others “Coming Soon” / `onSelected: null`. `setLocale` clamps; `LocalePrefs.fromJson` forces `en`. `fuzzy_locale_test` covers pack readiness.                                                                                            |

### Automated verification (this sprint)

```
flutter analyze lib test  → No issues found
flutter test              → All tests passed (98)
Targeted re-run after UX edits → All tests passed (39+)
```

### Device limitation (honest)

Physical Android device / emulator matrix **not available** on this Windows host for interactive biometric or live network retest. Biometrics and HTTPS probe are **code-verified**; Sprint 1 APK remains the prior binary for side-by-side device comparison if needed.

---

## Phase 2 — Flow verification matrix

| Flow                   | Status                                 | Notes                                                                                   |
| ---------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| Create / Import Wallet | **Works**                              | Onboarding + secure storage; no Sprint 2 changes.                                       |
| Portfolio              | **Works**                              | Preview balances + live/stale prices; sync error/offline banners + Retry.               |
| Asset Details          | **Works** (copy fixed)                 | Banner clarifies preview balances vs live CoinGecko; funding copy locked.               |
| Send                   | **Alpha-gated (clear UX)**             | Preview transfer; broadcast kill switch messaging on confirm/success.                   |
| Receive                | **Alpha-gated (clear UX)**             | Title “Receive (locked)”; QR/copy/share disabled; funding banner.                       |
| Swap                   | **Alpha-gated (clear UX)**             | Digital asset flow preview banner; authorize preview.                                   |
| Bridge                 | **Alpha-gated (clear UX)**             | Listed as “(preview)” in More actions + sheet banner.                                   |
| Stake                  | **Alpha-gated (clear UX)**             | Same preview labeling.                                                                  |
| Buy Preview            | **Alpha-gated (clear UX)**             | Auvora preview only; live partners Coming Soon. Empty Home primary CTA → Buy (preview). |
| Security Center        | **Works**                              | PIN/biometrics/recovery gates; confirmation toggles labeled Alpha-required.             |
| Recovery Phrase        | **Works**                              | Auth-gated reveal / verify.                                                             |
| Biometrics             | **Works** (device enrollment required) | FragmentActivity + unlock auto-prompt + PIN fallback.                                   |
| PIN                    | **Works**                              | Unlock, change PIN, sensitive-action fallback.                                          |
| Settings               | **Works**                              | Appearance English-only; privacy analytics/crash clearly unavailable.                   |
| Notifications          | **Works** (Alpha-honest)               | In-app center + toggles; push prepared behind OS permission (copy already clear).       |
| WalletConnect          | **Alpha-gated (clear UX)**             | Preview pairing / sessions; not live relay.                                             |
| Help Center            | **Works**                              | Offline FAQ cache; Alpha feedback paths.                                                |
| Offline Mode           | **Works**                              | Offline banners; prepare-only; confirm blocked offline.                                 |
| Resume Online          | **Works**                              | SyncCoordinator reconnect + resume refresh.                                             |
| Background Sync        | **Alpha-gated (clear UX)**             | No OS WorkManager; Diagnostics + About state foreground-only triggers.                  |

---

## Phase 3–4 — UI / trust changes (Sprint 2)

Minimal polish only — no redesign:

1. **Empty Home portfolio** — When funding locked: primary **Buy (preview)**, secondary **Receive (locked)**; Alpha copy; address redacted.
2. **Home primary actions** — SoftBanner: funding locked + Send/Swap/Buy are previews.
3. **Sell · Bridge · Stake sheet** — Preview SoftBanner; row titles “(preview)”.
4. **Activity empty state** — No longer implies “Receive or buy” as live funding path under Alpha lock.
5. **Asset detail banner** — Honest: preview balances + CoinGecko when reachable + funding locked.
6. **Home cache banner** — Removed misleading “in the background” (OS-sounding) wording.
7. **Diagnostics** — SoftBanner: OS background sync not wired; lists real refresh triggers.
8. **About release notes** — Stabilization / soft-gate / foreground-sync bullets.
9. **Buy provider tests** — Assert Ramp/Transak locked + reasons present.

---

## Phase 5–6 — Android + performance

### What was possible

| Check                             | Result                                        |
| --------------------------------- | --------------------------------------------- |
| `flutter analyze lib test`        | No issues                                     |
| Full `flutter test`               | 98 passed                                     |
| Release APK (arm64)               | Built → see APK path below                    |
| Gradle home                       | `D:\auvora-build\gradle-home`                 |
| Physical device / emulator matrix | **Not run** (no device/emulator on this host) |

### Performance notes

- Sprint 1 stable `SyncEngine` / `PortfolioRepository` reuse retained (avoids split diagnostics / portfolio state on Provider rebuilds).
- Soft portfolio refresh still keeps holdings visible (`soft: true`).
- No heavy rebuild refactors this sprint; copy/gating only on hot paths.
- CoinGecko public rate limits remain the main live-price risk (stale banner + seeded fallback).

### APK

- **Path:** `D:\auvora-build\dist\alpha-1.0.0-stabilization-sprint-2\auvora-wallet-1.0.0-alpha-sprint2-release.apk`
- **Target:** `android-arm64`
- **Size:** ~41.0 MB (42,955,865 bytes)
- **SHA-256:** `9D95F49E55CAF1D73C646BA002927E0932DD3822DA9C146569121A584B01DA9C`
- **Checksums file:** `D:\auvora-build\dist\alpha-1.0.0-stabilization-sprint-2\SHA256SUMS.txt`

---

## Phase 7 — Multi-persona self-review

| Persona                | Verdict                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **New alpha user**     | Empty state no longer pushes locked Receive as the hero CTA; Buy preview + locked Receive are understandable.           |
| **Security-conscious** | Funding addresses stay redacted/locked; broadcast remains preview; biometrics need enrolled hardware (documented).      |
| **Power user**         | Swap/Bridge/Stake clearly preview; WalletConnect preview; Diagnostics explains sync limits.                             |
| **Support / feedback** | Alpha feedback + Help Center paths intact; About notes updated.                                                         |
| **QA**                 | Analyze + full unit suite green; interactive Android still needs one physical retest pass for biometrics + live prices. |

Would we be embarrassed handing this to closed beta as-is? **No**, provided testers get the Alpha caveats sheet (kill switches, preview adapters, no OS background sync).

---

## Remaining known issues

1. Live broadcast / funding still gated by design.
2. Balances/history still preview adapters (not mainnet RPC).
3. No OS background WorkManager / BGTaskScheduler hooks.
4. CoinGecko anonymous rate limits without `--dart-define=COINGECKO_API_KEY=...`.
5. Biometrics require device enrollment; not retested on physical hardware this sprint.
6. Buy/sell partners not live until rails + KYC.
7. WalletConnect is local preview pairing, not a live relay.
8. Plugin KGP warning (`mobile_scanner`, `share_plus`) — build still succeeds; track for future Flutter Kotlin migration.

---

## Recommendations before Closed Beta

1. **One physical Android smoke** — unlock biometrics, pull-to-refresh prices, offline/online toggle, Receive locked UI, Send preview confirm.
2. Optional CoinGecko demo key via CI dart-define (never commit secrets).
3. Wire WorkManager (or document “foreground-only sync” in tester onboarding) before marketing “background sync.”
4. Keep kill switches until HD receive sign-off + broadcast audit.
5. Upgrade `mobile_scanner` / `share_plus` when Built-in Kotlin–compatible versions land.

---

## Confidence

**Hand to 100 alpha testers? YES**

Rationale: Sprint 1 functional fixes hold under analyze/tests/code review; Sprint 2 removed the most confusing Alpha CTAs so gated flows read as intentional, not broken. Residual risk is device-specific biometrics/network and expected Alpha kill switches — acceptable for a closed alpha cohort with clear briefing, not for open store users.

---

## Files touched (Sprint 2)

| Area                        | Files                                                                      |
| --------------------------- | -------------------------------------------------------------------------- |
| Trust / Home                | `home_tab.dart`, `activity_tab.dart`                                       |
| Asset / About / Diagnostics | `asset_detail_screen.dart`, `about_screen.dart`, `diagnostics_screen.dart` |
| Tests                       | `quote_engine_test.dart`                                                   |
| Docs                        | `docs/ALPHA_STABILIZATION_SPRINT_2_REPORT.md`                              |
