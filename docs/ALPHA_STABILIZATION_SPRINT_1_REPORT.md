# Alpha Stabilization Sprint 1 Report

**Date:** 2026-07-31  
**Scope:** Physical Android Alpha feedback — stabilize existing product (no new features, no redesign)  
**App:** `apps/mobile` · Version 1.0 Alpha (`1.0.0-alpha.1`)

---

## Summary

| Priority | Issue                                        | Status                     |
| -------- | -------------------------------------------- | -------------------------- |
| P0       | Biometrics not functioning                   | **Fixed**                  |
| P0       | Network synchronization not functioning      | **Fixed / clarified**      |
| P0       | Live market prices not updating              | **Fixed**                  |
| P1       | Buy providers selectable but not operational | **Soft-messaging fixed**   |
| P2       | Language options                             | **Coming Soon + disabled** |

Kill switches unchanged: `liveBroadcastEnabled = false`, `allowFundingAddresses = false`. Prices/sync do not depend on live broadcast.

---

## P0-1 Biometrics

### Issues found

- `MainActivity` extended `FlutterActivity`. Android `local_auth` / `BiometricPrompt` requires `FlutterFragmentActivity`.
- Availability check treated `isDeviceSupported()` alone as enough (true even with no enrolled biometrics).
- Enable/unlock paths swallowed `PlatformException` with vague errors.
- Unlock screen did not auto-prompt biometrics when enabled (PIN-only felt broken).

### Root causes

1. Wrong Activity base class → BiometricPrompt fails on physical Android.
2. Weak device/enrolled checks and error mapping.
3. No auto-prompt on unlock.

### Fixes

- Switched `MainActivity` to `FlutterFragmentActivity`.
- Manifest already had `USE_BIOMETRIC` / `USE_FINGERPRINT` — left as-is.
- `canCheckBiometrics()` now requires device support + enrolled biometrics.
- Clearer PlatformException messages; PIN remains the fallback on unlock and sensitive actions.
- Unlock screen auto-prompts biometrics once when enabled; passcode always available.

### Key files

- `apps/mobile/android/app/src/main/kotlin/com/auvora/auvora_wallet/MainActivity.kt`
- `apps/mobile/lib/state/wallet_controller.dart`
- `apps/mobile/lib/ui/unlock_screen.dart`

### Status

**Biometrics:** Ready for retest on physical Android. PIN fallback preserved.

---

## P0-2 Network synchronization

### Issues found

- Offline detection relied only on DNS (`InternetAddress.lookup`). Some Android networks/VPNs fail DNS while HTTPS still works → false “offline,” sync stuck on cache.
- Preview RPC `ping()` randomly marked endpoints degraded → perpetual “sync delayed / failed” banners even when preview sync succeeded.
- `SyncEngine` / `PortfolioRepository` were recreated on every Provider rebuild, splitting coordinator diagnostics from the portfolio path.
- Portfolio refresh had no user-visible error when load failed.

### Root causes

1. Fragile connectivity probe.
2. Simulated degradation in preview adapters.
3. Non-stable SyncEngine instance across rebuilds.
4. Silent failure UX.

### Fixes

- Offline detection: DNS primary, then HTTPS probe (`connectivitycheck.gstatic.com/generate_204`).
- Preview adapter ping always reports healthy (real RPC health lands with live broadcast).
- Reuse single `SyncEngine` / `PortfolioRepository` across Provider updates.
- Surface `lastSyncError` on Home with Retry.
- Honest Alpha note: OS background WorkManager hooks remain unwired; foreground resume / reconnect / pull-to-refresh / periodic health drive sync.

### Key files

- `apps/mobile/lib/wallet_engine/network_manager.dart`
- `apps/mobile/lib/wallet_engine/blockchain_adapter.dart`
- `apps/mobile/lib/main.dart`
- `apps/mobile/lib/portfolio/portfolio_controller.dart`
- `apps/mobile/lib/ui/home/home_tab.dart`
- `apps/mobile/lib/wallet_engine/sync_coordinator.dart`
- `apps/mobile/lib/ui/home_shell.dart`

### Status

**Sync:** Preview portfolio/tx refresh restored with clearer errors. Background OS hooks still limited (documented). Live chain RPC remains preview adapters until broadcast unlock.

---

## P0-3 Live market prices

### Issues found

- Portfolio sync called `PriceService.quotes()` without forcing refresh → cached quotes could stay forever until cold bootstrap.
- CoinGecko treated non-200 (incl. 429) as empty success → silent fallback to seeded static prices that looked “live” (`stale: false`).
- Missing User-Agent / optional API-key headers (public CoinGecko often rate-limits anonymous clients).
- Seeded fallback after live miss was not marked stale; Home price banner understated the problem.

### Root causes

1. No refresh interval / force-refresh on sync.
2. Soft-fail HTTP handling hid provider failures.
3. Stale semantics too weak for seeded failover.

### Fixes

- `quotes(..., forceRefresh: true)` on every portfolio sync; 2-minute refresh interval otherwise.
- CoinGecko throws on non-200 / empty payloads; User-Agent + optional `--dart-define=COINGECKO_API_KEY=...` (not committed).
- Seeded failover marks quotes stale when live providers exist; Home banner: “Live market prices temporarily unavailable… pull to refresh.”
- `ReleaseConfig.liveMarketPricesEnabled = true` (documentation flag; kill switches for broadcast/funding unchanged).

### Key files

- `apps/mobile/lib/wallet_engine/price_service.dart`
- `apps/mobile/lib/wallet_engine/coingecko_market_data_provider.dart`
- `apps/mobile/lib/wallet_engine/sync_engine.dart`
- `apps/mobile/lib/release/release_config.dart`
- `apps/mobile/lib/ui/home/home_tab.dart`

### Status

**Prices:** Live CoinGecko path restored with refresh + stale UX. If CoinGecko rate-limits, seeded last-known shows with explicit stale banner. Optional API key via dart-define only.

---

## P1 Buy providers

### Issues found

- MoonPay / Ramp / Transak appeared selectable in comparison UI while unavailable, which felt like a product break.
- Messaging leaned on buried “partner preview” copy.

### Fixes (soft messaging only)

- Alpha banner: live partners not operational; use Auvora preview.
- Unavailable rows: “Coming soon”, non-interactive, dimmed.
- Quotes forced to `auvora-sim` when a live partner is not available.
- Clearer unavailable reason strings.

### Key files

- `apps/mobile/lib/ui/engine/digital_asset_flow.dart`
- `apps/mobile/lib/engine/quote_engine.dart`

### Status

**Buy:** Preview flow only; live partners clearly “Coming soon,” not broken.

---

## P2 Language options

### Issues found

- Non-English packs were labeled “(soon)” but LocalePrefs could still persist a non-`en` code from older builds → risk of partial localization assumptions.

### Fixes

- Labels: “Coming Soon”; chips disabled for unready packs.
- `setLocale` clamps to supported codes (`en` only).
- `LocalePrefs.fromJson` forces `languageCode: 'en'`.
- Appearance copy clarifies English-only Alpha.

### Key files

- `apps/mobile/lib/l10n/auvora_locale.dart`
- `apps/mobile/lib/ui/settings/appearance_settings_screen.dart`
- `apps/mobile/lib/preferences/preferences_controller.dart`
- `apps/mobile/lib/preferences/models.dart`

### Status

**Language:** English only active; others Coming Soon / non-selectable.

---

## Spot fixes on touched surfaces

- Unlock auto-biometric + clearer subtitle.
- Home sync/price/error banners with Retry.
- Buy Alpha soft banner without redesigning the flow.

---

## Verification

### Analyze

```
flutter analyze lib test
→ No issues found
```

### Tests run

```
flutter test \
  test/wallet_engine_test.dart \
  test/reliability_test.dart \
  test/fuzzy_locale_test.dart \
  test/quote_engine_test.dart \
  test/portfolio_test.dart \
  test/preferences_controller_test.dart
→ All tests passed (42+)
```

### APK

- **Rebuilt:** Yes (`flutter build apk --release`)
- **Output:** `D:\auvora-build\dist\alpha-1.0.0-stabilization-sprint-1\auvora-wallet-1.0.0-alpha-sprint1-release.apk` (also copied under `D:\auvora-build\dist\alpha-1.0.0\` when present)
- Gradle home: `D:\auvora-build\gradle-home`
- Size: ~80.1 MB

---

## Remaining known issues (Alpha-honest)

1. **Live broadcast / funding still gated** — transfers and receive QR remain preview/locked by design.
2. **Balances/history still preview adapters** — not real mainnet RPC until broadcast unlock; sync “works” for Alpha preview data + live prices.
3. **No OS background sync hooks** — refresh on resume/reconnect/manual/periodic foreground only.
4. **CoinGecko rate limits** — without `COINGECKO_API_KEY`, public API may throttle; UI shows stale banner + last quotes.
5. **Biometrics need device enrollment** — fingerprint/face must be set in Android Settings.
6. **Buy partners** — not live until rails + KYC connect post-Alpha.

---

## Files changed (primary)

| Area       | Files                                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Biometrics | `MainActivity.kt`, `wallet_controller.dart`, `unlock_screen.dart`                                                                                        |
| Sync       | `network_manager.dart`, `blockchain_adapter.dart`, `main.dart`, `portfolio_controller.dart`, `home_tab.dart`, `sync_coordinator.dart`, `home_shell.dart` |
| Prices     | `price_service.dart`, `coingecko_market_data_provider.dart`, `sync_engine.dart`, `release_config.dart`                                                   |
| Buy        | `digital_asset_flow.dart`, `quote_engine.dart`                                                                                                           |
| Language   | `auvora_locale.dart`, `appearance_settings_screen.dart`, `preferences_controller.dart`, `models.dart`                                                    |
| Tests      | `fuzzy_locale_test.dart`                                                                                                                                 |
| Docs       | `docs/ALPHA_STABILIZATION_SPRINT_1_REPORT.md`                                                                                                            |
