# Final Release Verification Report — Auvora Wallet Version 1.0 Alpha

**Date:** 2026-07-31  
**Verifier host:** Windows (`DESKTOP-7SPQ3BE`) · Flutter 3.44.8 · Dart 3.12.2 · Node v24.18.0 · pnpm 9.15.9  
**Product version:** `1.0.0-alpha.1` · channel `alpha` · mobile build `+5`  
**Scope:** Evidence-based readiness check for physical Android / iPhone install and release gates. **No new features implemented during this verification.**

---

## Executive summary

| Question                                     | Answer                                    | Why                                                                                              |
| -------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1. Install on an Android phone **today**?    | **YES**                                   | Sideload the existing arm64 release APK (debug-signed). Requires “install unknown apps.”         |
| 2. Install on an iPhone **today**?           | **NO**                                    | No IPA / archive exists; this Windows host cannot produce one without macOS + Xcode.             |
| 3. Ready for **internal testing**?           | **YES** _(Android + Web, trusted cohort)_ | Kill switches verified; analyze/tests/web build green. iOS cohort blocked until macOS build.     |
| 4. Ready for **Google Play** submission?     | **NO**                                    | Debug-signed AAB/APK; missing upload keystore, Play Console metadata/graphics, hosted legal ops. |
| 5. Ready for **Apple App Store** submission? | **NO**                                    | No IPA; signing/provisioning unverified; Universal Links / branded icons still open.             |

| Metric                                        | Score        | Notes                                                                               |
| --------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| **Overall completion (Alpha scope)**          | **~91%**     | Product surface + Android binaries + web + docs; iOS binary gap                     |
| **Closed Alpha readiness**                    | **87 / 100** | Safe for simulated / locked-funding internal cohort on Android + web                |
| **Production readiness (live funds + store)** | **54 / 100** | Preview rails, kill switches, debug signing, no iOS binary, store assets incomplete |

**Recommendation:** Proceed with **Android sideload + web companion** for trusted Alpha testers. Do **not** enable funding/broadcast, do **not** submit to Play/App Store production tracks, and do **not** claim iPhone install readiness until a macOS archive exists.

---

## Reconciliation with prior docs

| Document                                                                                                            | Prior claim                                                            | Verified now (2026-07-31)                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`MASTER_BUILD_PROMPT_10_REPORT.md`](MASTER_BUILD_PROMPT_10_REPORT.md)                                              | APK ~41 MB, AAB ~68 MB; analyze clean; 93 Flutter tests; web green     | **Confirmed** artifacts on `D:\auvora-build\dist\alpha-1.0.0\`. Analyze clean. Flutter tests now **97 passed** (was 93). Web **9** tests (was 7).          |
| Same                                                                                                                | “READY FOR INTERNAL ALPHA TESTING”                                     | **Still valid** for Android + web with kill switches.                                                                                                      |
| Same                                                                                                                | Android “debug-signed without upload keystore”                         | **Confirmed** via `apksigner`: signer DN `CN=Android Debug`. `key.properties` **absent**.                                                                  |
| [`RELEASE_CANDIDATE_RC1.md`](RELEASE_CANDIDATE_RC1.md)                                                              | Version `1.1.0-rc.1`; APK path under `apps/mobile/build/...` (75.2 MB) | **Superseded for packaging** by Alpha `1.0.0-alpha.1`. Dist APK is **arm64 ~41 MB**. RC1 security/a11y/perf findings remain relevant as historical audits. |
| [`ALPHA_1.0_RELEASE_NOTES.md`](ALPHA_1.0_RELEASE_NOTES.md)                                                          | Funding/broadcast locked; crash SDK unwired                            | **Confirmed** in `ReleaseConfig` + tests.                                                                                                                  |
| [`RM2_KNOWN_ISSUES_REGISTER.md`](RM2_KNOWN_ISSUES_REGISTER.md)                                                      | KI-C01–C03, KI-H01–H05, KI-M05/M06 open                                | **Still open** where re-checked (funding lock, broadcast off, debug signing, no OS BG sync, no IPA).                                                       |
| [`RC1_SECURITY_AUDIT.md`](RC1_SECURITY_AUDIT.md)                                                                    | PASS for Closed Alpha / FAIL live funding                              | Kill switches **re-verified in code + unit tests today**. Full pen-test **not re-run** → marked “documented previously.”                                   |
| [`RC1_ACCESSIBILITY_AUDIT.md`](RC1_ACCESSIBILITY_AUDIT.md) / [`RC1_PERFORMANCE_AUDIT.md`](RC1_PERFORMANCE_AUDIT.md) | Partial a11y; Alpha perf pass                                          | **Not re-labbed on devices today** → “documented previously, not re-verified today.”                                                                       |
| [`STORE_READINESS_ALPHA_1.0.md`](STORE_READINESS_ALPHA_1.0.md)                                                      | Structural IDs ready; store graphics/keystore missing                  | **Aligned** with this report.                                                                                                                              |

---

## Phase 1 — Build verification

### 1. Android APK — **READY** (for sideload)

| Field        | Value                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------ |
| Dist path    | `D:\auvora-build\dist\alpha-1.0.0\auvora-wallet-1.0.0-alpha.1-arm64.apk`                   |
| Size         | **40.97 MB**                                                                               |
| Modified     | 2026-07-31 12:49:17 PM                                                                     |
| SHA-256      | `b6aeb67f1bf3f41f4c2b9be90462236277d15d812f988e40d2bdc6875cd087e9`                         |
| Also mirrors | `D:\auvora-build\mobile-build\app\outputs\flutter-apk\app-release.apk` (same size/time)    |
| Signing      | **Android Debug** certificate (`apksigner verify --print-certs`)                           |
| ABI note     | Artifact name indicates **arm64** release target (matches Prompt 10 `android-arm64` build) |

**Why READY:** File exists, hashes present, size/date consistent with today’s rebuild narrative. Suitable for physical arm64 Android sideload. **Not** Play-upload ready due to debug signing.

### 2. Android AAB — **PARTIALLY READY**

| Field     | Value                                                              |
| --------- | ------------------------------------------------------------------ |
| Dist path | `D:\auvora-build\dist\alpha-1.0.0\auvora-wallet-1.0.0-alpha.1.aab` |
| Size      | **68.35 MB**                                                       |
| Modified  | 2026-07-31 12:51:26 PM                                             |
| SHA-256   | `0f20c332a2b7b7f4916edc9521148c06427ecf04c38b90bf389a883028b8b1a3` |
| Signing   | Expected same debug-key fallback as APK (`key.properties` missing) |

**Why PARTIALLY READY:** Bundle exists and is buildable, but Play Internal Testing / production upload typically requires a proper **upload keystore**. Do not treat as store-submittable.

### 3. Android release build config — **PARTIALLY READY**

| Item                          | Status                        | Evidence                                                                                                  |
| ----------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `applicationId`               | `com.auvora.auvora_wallet`    | `apps/mobile/android/app/build.gradle.kts`                                                                |
| `versionName` / `versionCode` | `1.0.0-alpha.1` / `5`         | `apps/mobile/pubspec.yaml` → `1.0.0-alpha.1+5`; Gradle uses `flutter.versionName` / `flutter.versionCode` |
| `key.properties`              | **Missing**                   | Only `key.properties.example` present — secrets not read/reported                                         |
| Release signing               | Falls back to **debug**       | `build.gradle.kts` `signingConfig` branch                                                                 |
| Minify / R8                   | **Off**                       | `isMinifyEnabled = false`, `isShrinkResources = false`                                                    |
| ProGuard file                 | Present but unused for minify | `proguard-rules.pro` referenced                                                                           |
| Cleartext                     | Disabled                      | `network_security_config.xml`                                                                             |
| Backup                        | Disabled                      | `allowBackup="false"`                                                                                     |

### 4. iOS project — **READY** (source / plist) · binary **NOT READY**

| Item                                 | Status                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `apps/mobile/ios` exists             | Yes (`Runner.xcodeproj`, `Runner/Info.plist`)                                   |
| Display name                         | `Auvora Wallet`                                                                 |
| Bundle ID                            | `com.auvora.auvoraWallet` (`project.pbxproj`)                                   |
| Version / build                      | `$(FLUTTER_BUILD_NAME)` / `$(FLUTTER_BUILD_NUMBER)` → `1.0.0-alpha.1` / `5`     |
| Face ID string                       | Present (`NSFaceIDUsageDescription`)                                            |
| Camera string                        | Present (`NSCameraUsageDescription`)                                            |
| URL schemes                          | `auvora`, `wc`                                                                  |
| Deep linking flag                    | `FlutterDeepLinkingEnabled` = true                                              |
| Export compliance                    | `ITSAppUsesNonExemptEncryption` = false                                         |
| Associated Domains / Universal Links | **Not found** (no `.entitlements` with associated domains)                      |
| Push capability                      | **Not configured** (no push entitlements; intentional for Alpha per store docs) |

### 5. iOS archive readiness — **NOT READY**

- Host OS is **Windows** — cannot run Xcode / `flutter build ipa`.
- **No `.ipa`** found under `D:\auvora-build\dist` or the repo.
- Apple signing / provisioning profiles: **cannot verify** without Apple Developer account + macOS.

### 6. Web production build — **READY**

Re-run today on this host:

| Check                                 | Result                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm --filter @auvora/web test`      | **9 passed** / 4 suites                                                              |
| `pnpm --filter @auvora/web typecheck` | **PASS**                                                                             |
| `pnpm --filter @auvora/web lint`      | **PASS**                                                                             |
| `pnpm --filter @auvora/web build`     | **PASS** — Next.js 15.5.21, **82** routes                                            |
| Engine warning                        | `package.json` wants Node `22.x`; host ran **v24.18.0** (warn only; build succeeded) |
| Env                                   | `apps/web/.env.local` **exists** (contents not inspected for this report)            |

Mobile QA re-run today:

| Check             | Result                    |
| ----------------- | ------------------------- |
| `flutter analyze` | **No issues found**       |
| `flutter test`    | **All tests passed — 97** |

---

## Phase 2 — Project health

| Area                | Rating                                     | Evidence                                                                                                                             |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Architecture        | Strong for Alpha                           | Wallet engine, sync/reliability, security controller, connections, ReleaseConfig gates                                               |
| Build health        | Strong (Android + Web) / Weak (iOS binary) | Artifacts on D:; Flutter+web green; IPA absent                                                                                       |
| Dependency health   | Acceptable                                 | Flutter: 35 outdated constrained packages (info). Web workspace builds.                                                              |
| TypeScript          | Clean (today)                              | Web typecheck PASS                                                                                                                   |
| Lint                | Clean (today)                              | Web eslint PASS; Flutter analyze PASS                                                                                                |
| Runtime (automated) | Green                                      | 97 Flutter + 9 web tests                                                                                                             |
| Tests               | Good unit/widget coverage for Alpha rails  | Not a substitute for physical device matrix (KI-H01)                                                                                 |
| Security            | Pass for locked Alpha                      | Kill switches on; secure storage used; crash/analytics unwired. Argon2id still pending (KI-C03). Full RC1 audit **not re-executed**. |
| Performance         | Documented previously                      | Prompt 10 tree-shake + ~41 MB APK. Device FPS/battery **not re-measured today**.                                                     |
| Accessibility       | Partial                                    | Settings + prior RC1 fixes exist; VoiceOver/TalkBack lab open (KI-H02) — **not re-verified today**.                                  |
| Code quality        | Good for Alpha                             | Analyze clean; intentional preview adapters; minify deferred                                                                         |

**Disk note (this machine):** C: ~**4.1 GB** free · D: ~**98 GB** free. Heavy Android rebuilds should stay on `D:\auvora-build` (as Prompt 10 documented).

---

## Phase 3 — Feature verification

Legend: **Implemented** = present in code with meaningful UX · **Partially** = UI/logic present but preview, locked, or incomplete · **Missing** = not shippable / not wired.

| Feature             | Status                    | Evidence / notes                                                                      |
| ------------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| Wallet Creation     | **Implemented**           | Onboarding / mnemonic generate (`wallet_controller.dart`, create flows)               |
| Wallet Import       | **Implemented**           | `import_screen.dart`                                                                  |
| Portfolio           | **Implemented**           | Home / portfolio controllers + tests (`portfolio_test.dart`) — **preview balances**   |
| Multi-chain Support | **Implemented**           | HD derivation across Prompt 2 networks (`wallet_engine_test.dart`)                    |
| Transaction History | **Implemented**           | Activity / `transaction_detail_screen.dart` (preview rails)                           |
| Send                | **Partially Implemented** | `send_flow_screen.dart` — **preview**; `liveBroadcastEnabled=false`                   |
| Receive             | **Partially Implemented** | `receive_flow_screen.dart` — QR/copy/share **locked** (`allowFundingAddresses=false`) |
| QR Scanner          | **Implemented**           | `qr_scanner_screen.dart` + `mobile_scanner` (camera permission declared)              |
| Address Book        | **Implemented**           | `address_book_screen.dart`, `transfer/address_book.dart`                              |
| Buy                 | **Partially Implemented** | `digital_asset_flow.dart` + quote engine — **simulated providers**                    |
| Sell                | **Partially Implemented** | Same engine — preview / irreversible warnings                                         |
| Swap                | **Partially Implemented** | Quote + UI — preview broadcast                                                        |
| Bridge              | **Partially Implemented** | Quote + UI — preview                                                                  |
| Stake               | **Partially Implemented** | Stake pools / quotes — preview                                                        |
| Security Center     | **Implemented**           | `security_center_screen.dart`                                                         |
| Recovery Phrase     | **Implemented**           | `backup_screen.dart`, `verify_screen.dart`                                            |
| Biometrics          | **Implemented**           | `biometric_screen.dart`, `local_auth`, Face ID / biometric permissions                |
| PIN                 | **Implemented**           | `pin_screen.dart` + lockout / constant-time compare tests                             |
| Trusted Devices     | **Implemented** _(local)_ | `TrustedDevice` in security models/controller — on-device list, not cloud attestation |
| Privacy Controls    | **Implemented**           | `privacy_settings_screen.dart`; analytics toggle honest/unwired                       |
| WalletConnect       | **Partially Implemented** | Provider ports + deep links (`auvora://`, `wc:`) — preview / fail-closed auth paths   |
| Permission Center   | **Implemented**           | `permission_center_screen.dart`, `permissions_screen.dart`                            |
| Deep Links          | **Partially Implemented** | Custom schemes ready; HTTPS App Links **without** `autoVerify` / DAL hosting          |
| Settings            | **Implemented**           | Settings home + account/networks/appearance/etc.                                      |
| Notifications       | **Partially Implemented** | Local categories/center + Android channels; **no push SDK**                           |
| Localization        | **Partially Implemented** | EN UI + `AuvoraLocale` formatting; language packs not shipped (KI-M01)                |
| Accessibility       | **Partially Implemented** | Accessibility settings + RC1 semantics; device lab open                               |
| Offline Support     | **Partially Implemented** | Cache-first sync, `OfflineActionQueue` (safe actions only)                            |
| Background Sync     | **Missing / deferred**    | OS WorkManager / BGTask **not wired** (KI-M06); foreground coordinator only           |
| Auvora Intelligence | **Implemented**           | Guidance / learning screens + tests (`intelligence_test.dart`) — non-advisory copy    |
| Help Center         | **Implemented**           | `help_support_screen.dart` + Alpha feedback                                           |
| Web Companion       | **Implemented**           | Next.js app `@auvora/web@1.0.0-alpha.1`, mirrored kill switches                       |

### Kill switches (verified in source + tests)

From `apps/mobile/lib/release/release_config.dart` and `apps/web/src/lib/release/config.ts`:

| Switch                    | Value                                            |
| ------------------------- | ------------------------------------------------ |
| `releaseChannel`          | `alpha`                                          |
| `marketingVersion`        | `1.0.0-alpha.1`                                  |
| `liveBroadcastEnabled`    | **false**                                        |
| `allowFundingAddresses`   | **false**                                        |
| `derivationMode` (mobile) | `bip32Partial`                                   |
| Crash / analytics SDK     | Unwired; prefs copy states nothing leaves device |

Blockchain path uses `PreviewBlockchainAdapter` (`wallet_engine/blockchain_adapter.dart`) — **demo/preview rails**, not audited live broadcast.

---

## Phase 4 — Mobile readiness

### Android

| Item              | Value / status                                                                   |
| ----------------- | -------------------------------------------------------------------------------- |
| Application ID    | `com.auvora.auvora_wallet`                                                       |
| Version name      | `1.0.0-alpha.1`                                                                  |
| Version code      | `5`                                                                              |
| Signing           | **Debug** (no `key.properties`)                                                  |
| APK               | Present — see Phase 1                                                            |
| AAB               | Present — debug-signed                                                           |
| Permissions       | INTERNET, CAMERA, USE_BIOMETRIC, USE_FINGERPRINT, POST_NOTIFICATIONS             |
| Icons             | mipmap densities + adaptive (`mipmap-anydpi-v26`) present                        |
| Splash            | LaunchTheme / splash resources present                                           |
| Deep links        | `auvora://`, `wc:`, HTTPS prefixes to `wallet.auvora.app` (no autoVerify)        |
| Notifications     | Channels created in `MainActivity.kt`                                            |
| Screenshot guard  | `FLAG_SECURE` channel present (Android)                                          |
| Blockers for Play | Upload keystore, minify validation, store listing assets, console questionnaires |

### iOS

| Item                   | Value / status                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Bundle ID              | `com.auvora.auvoraWallet`                                                                            |
| Version / build        | `1.0.0-alpha.1` / `5` (via Flutter)                                                                  |
| Signing / provisioning | **Cannot verify** without Apple account + macOS                                                      |
| Face ID                | Usage string present                                                                                 |
| Push                   | Not configured                                                                                       |
| Universal Links        | Not configured                                                                                       |
| IPA                    | **None**                                                                                             |
| Blockers               | macOS archive, certificates, branded Asset Catalog icons, Associated Domains for store-quality links |

---

## Phase 5 — Release blockers

### Critical

| ID   | Blocks                                  | Issue                                                              |
| ---- | --------------------------------------- | ------------------------------------------------------------------ |
| B-C1 | iPhone install / App Store / TestFlight | No IPA; Windows cannot archive                                     |
| B-C2 | Live funding / Public Beta              | `allowFundingAddresses=false`; HD not off-device verified (KI-C01) |
| B-C3 | Live transfers / Public Beta            | `liveBroadcastEnabled=false` + preview adapter (KI-C02)            |

### High

| ID   | Blocks                                               | Issue                                                                       |
| ---- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| B-H1 | Google Play upload / Internal testing track (proper) | Release AAB/APK **debug-signed**; no upload keystore (KI-M05)               |
| B-H2 | Physical cohort confidence                           | Device matrix unsigned (KI-H01) — automation ≠ device UAT                   |
| B-H3 | Store review                                         | Hosted `wallet.auvora.app` legal/marketing must be live & monitored mailbox |
| B-H4 | Production crypto hardness                           | PIN KDF not Argon2id (KI-C03) — accept for locked Alpha only                |
| B-H5 | iOS privacy parity                                   | Screenshot guard missing on iOS (KI-H05)                                    |

### Medium

| ID   | Blocks                               | Issue                                                    |
| ---- | ------------------------------------ | -------------------------------------------------------- |
| B-M1 | Play/App Store polish                | Feature graphic + screenshots placeholders               |
| B-M2 | Verified App Links / Universal Links | DAL / Associated Domains deferred                        |
| B-M3 | Binary size / reverse-eng            | R8/minify still off                                      |
| B-M4 | Background freshness                 | OS background sync not wired (KI-M06)                    |
| B-M5 | Build host risk                      | C: disk ~4 GB free — rebuilds can fail without D: caches |
| B-M6 | Node engine drift                    | Web engines field wants 22.x; verified on 24.x           |

### Low

| ID   | Issue                                                                               |
| ---- | ----------------------------------------------------------------------------------- |
| B-L1 | Flutter plugin KGP warnings (`mobile_scanner` / `share_plus`) — future tooling risk |
| B-L2 | EN-only localization (KI-M01)                                                       |
| B-L3 | Remaining a11y contrast / TalkBack lab debt (KI-H02)                                |

---

## Phase 6 — File locations

### Binaries / build caches

| Artifact                | Path                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| Alpha APK (canonical)   | `D:\auvora-build\dist\alpha-1.0.0\auvora-wallet-1.0.0-alpha.1-arm64.apk` |
| Alpha AAB (canonical)   | `D:\auvora-build\dist\alpha-1.0.0\auvora-wallet-1.0.0-alpha.1.aab`       |
| SHA256 sums             | `D:\auvora-build\dist\alpha-1.0.0\SHA256SUMS.txt`                        |
| Flutter build outputs   | `D:\auvora-build\mobile-build\app\outputs\...`                           |
| Gradle home (this host) | `D:\auvora-build\gradle-home`                                            |
| Pub cache (this host)   | `D:\auvora-build\pub-cache`                                              |
| IPA                     | **Not found**                                                            |

### Source projects

| Item                    | Path                                                        |
| ----------------------- | ----------------------------------------------------------- |
| Mobile (Flutter)        | `C:\Users\kwasi\Projects\auvora-wallet\apps\mobile`         |
| Android project         | `C:\Users\kwasi\Projects\auvora-wallet\apps\mobile\android` |
| iOS project             | `C:\Users\kwasi\Projects\auvora-wallet\apps\mobile\ios`     |
| Web companion           | `C:\Users\kwasi\Projects\auvora-wallet\apps\web`            |
| Release config (mobile) | `apps/mobile/lib/release/release_config.dart`               |
| Release config (web)    | `apps/web/src/lib/release/config.ts`                        |

### Env / signing templates

| Item                    | Path                                                              | Note                               |
| ----------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| Repo env examples       | `.env.example`, `.env.staging.example`, `.env.production.example` | Templates only                     |
| Web local env           | `apps/web/.env.local`                                             | Present; **do not commit secrets** |
| Android signing example | `apps/mobile/android/key.properties.example`                      | Real `key.properties` **absent**   |

### Key docs

| Doc                        | Path                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------- |
| This report                | `docs/FINAL_RELEASE_VERIFICATION_REPORT.md`                                            |
| Prompt 10 report           | `docs/MASTER_BUILD_PROMPT_10_REPORT.md`                                                |
| Alpha release notes        | `docs/ALPHA_1.0_RELEASE_NOTES.md`                                                      |
| Launch checklist           | `docs/ALPHA_1.0_LAUNCH_CHECKLIST.md`                                                   |
| Testing guide              | `docs/TESTING_GUIDE_ALPHA_1.0.md`                                                      |
| Release guide              | `docs/RELEASE_GUIDE_ALPHA_1.0.md`                                                      |
| Store readiness            | `docs/STORE_READINESS_ALPHA_1.0.md`                                                    |
| RC1 gate                   | `docs/RELEASE_CANDIDATE_RC1.md`                                                        |
| Known issues               | `docs/RM2_KNOWN_ISSUES_REGISTER.md`                                                    |
| RC1 security / a11y / perf | `docs/RC1_SECURITY_AUDIT.md`, `RC1_ACCESSIBILITY_AUDIT.md`, `RC1_PERFORMANCE_AUDIT.md` |

---

## Phase 7 — Executive YES/NO (detail)

1. **Android phone today — YES.** Copy `auvora-wallet-1.0.0-alpha.1-arm64.apk` to an arm64 device, enable unknown sources / ADB install. Expect debug-key install warnings. Confirm kill-switch messaging on Receive/Send.
2. **iPhone today — NO.** Need macOS, Xcode, Apple team signing, then archive/IPA or TestFlight.
3. **Internal testing — YES** for trusted Android + web testers on **simulated / locked** Alpha rails. Follow `TESTING_GUIDE_ALPHA_1.0.md`. iOS internal testing waits on B-C1.
4. **Google Play — NO.** Debug signing, incomplete store package, Alpha not a production track candidate.
5. **App Store — NO.** No binary, unverified signing, incomplete store assets / Universal Links.

---

## Exact next steps before physical device install

### Android (can do immediately)

1. Transfer `D:\auvora-build\dist\alpha-1.0.0\auvora-wallet-1.0.0-alpha.1-arm64.apk` to the phone (USB/cloud).
2. Verify SHA-256 against `SHA256SUMS.txt`.
3. Install via Files “Install unknown apps” or `adb install -r <apk>`.
4. Smoke: create/import wallet → lock/unlock → Receive shows **locked** → Send shows **preview** → Settings → About / Alpha feedback.
5. Do **not** send real funds to any address shown.

### iPhone (blocked until macOS)

1. On a Mac with Xcode: open `apps/mobile/ios`, set team signing for `com.auvora.auvoraWallet`.
2. `flutter build ipa` (or Archive in Xcode) → distribute via TestFlight or ad-hoc.
3. Replace default App Icon asset catalog before external testers.
4. Re-run smoke checklist above.

### Optional before broader internal Android cohort

1. Create upload keystore + `android/key.properties` (never commit secrets) and rebuild AAB for Play **internal** track.
2. Publish privacy/terms at configured URLs; monitor `alpha@auvora.app`.
3. Run the physical device matrix in `TESTING_GUIDE_ALPHA_1.0.md` / KI-H01.

---

## Known issues (current, honest)

Open items remain as in [`RM2_KNOWN_ISSUES_REGISTER.md`](RM2_KNOWN_ISSUES_REGISTER.md), plus verification-specific notes:

- **KI-C01 / KI-C02:** Funding & live broadcast intentionally locked — **reconfirmed**.
- **KI-C03:** PIN KDF not Argon2id — open.
- **KI-H01:** Physical device matrix unsigned — open (**automation only today**).
- **KI-H02:** TalkBack/VoiceOver lab incomplete — open (prior RC1 audit only).
- **KI-H04:** Crash reporter unwired — mitigated with honest UI.
- **KI-H05:** iOS screenshot guard missing — open.
- **KI-M01 / M05 / M06:** l10n, debug signing, OS background sync — open.
- **Host:** C: low disk; keep builds on D:.
- **Version doc drift:** RC1 docs still label `1.1.0-rc.1` while shipping package is `1.0.0-alpha.1` — treat Alpha docs + this report as packaging truth.

---

## Verification commands run (2026-07-31)

```text
flutter analyze          → No issues found
flutter test             → 97 passed
pnpm --filter @auvora/web test       → 9 passed
pnpm --filter @auvora/web typecheck  → PASS
pnpm --filter @auvora/web lint       → PASS
pnpm --filter @auvora/web build      → PASS (82 routes)
apksigner verify --print-certs <apk> → CN=Android Debug
```

Android APK/AAB were **not rebuilt** during this verification; existing dist artifacts dated today (12:49–12:51) were inspected.

---

## Final verdict

**Version 1.0 Alpha is READY for trusted internal testing on Android (sideload) and Web companion**, with hard funding/broadcast locks and preview blockchain rails.

**It is NOT READY for iPhone install today, Google Play submission, App Store submission, or any live-money use.**

| Scorecard                |                                                                   |
| ------------------------ | ----------------------------------------------------------------- |
| Overall Alpha completion | **~91%**                                                          |
| Android readiness        | **~90 / 100** (sideload) · **~55 / 100** (Play)                   |
| iOS readiness            | **~70 / 100** (project config) · **0 / 100** (installable binary) |
| Web readiness            | **~96 / 100**                                                     |
| Closed Alpha readiness   | **87 / 100**                                                      |
| **Production readiness** | **54 / 100**                                                      |

_— End of report —_
