# Master Build Prompt 1 of 10 — Foundation Report

**Date:** 2026-07-30  
**Channel:** Mobile `1.1.0-beta.1` Closed Beta · Web companion  
**Scope:** Audit → cleanup → fix build → foundation / security / UI / perf / test  
**Status:** Complete — web + Flutter gates green; **Android release APK built on this host**; iOS requires macOS (see §§8–10)

---

## 1. Existing features found

### Mobile (`apps/mobile`)

- Splash → welcome → create / import → BIP39 backup + verify → PIN → biometrics → permissions → Home shell
- Bottom navigation: Home / Assets / Activity / More
- Device lock, background auto-lock, weak-PIN denylist, PIN lockout, iterated SHA-256 PIN v2
- Secure mnemonic storage (`flutter_secure_storage` + iOS Keychain options)
- Security Center (fail-closed auth), Settings suite, Diagnostics, Beta feedback
- Guided Send / Receive (Receive funding locked via `ReleaseConfig`)
- Portfolio / sync engine with preview adapters; kill switches off for live broadcast
- Theme system (light / dark / system), reduce-motion-aware splash
- Web3 connections controller (pair / approve / revoke) — empty boot, no fake sessions
- Auvora Intelligence guidance layer

### Web (`apps/web`)

- Marketing + wallet companion surfaces (portfolio, settings, web3, trading previews)
- Settings including Closed Beta feedback; privacy defaults opt-in
- JWT in `sessionStorage` (migrates legacy `localStorage`)
- Gateway-backed paths when `NEXT_PUBLIC_API_URL` + token present

### Platform

- NestJS services, Prisma/Postgres (not Supabase), CI, shared packages
- Prior audits: `docs/FULL_PROJECT_AUDIT_REPORT.md`, RM1/RM2 readiness docs

---

## 2. Features improved

| Area            | Change                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Honesty / copy  | Closed Beta wording on welcome, permissions, create Terms, Buy/Sell CTAs, crash reporting, AccessTokenPanel |
| Splash / a11y   | Splash respects `disableAnimations` / reduce motion before animating                                        |
| Connections     | Stopped auto-seeding fake WalletConnect sessions/activity                                                   |
| Security Center | Removed unused demo device/session/dapp/alert seed data                                                     |
| Analyze hygiene | `RadioGroup` for guidance radios; const constructors; gradle TODOs removed                                  |
| Tests           | Connections tests assert empty boot; sessions created via approve path                                      |
| Docs            | Mobile README updated for Closed Beta / Prompt 1                                                            |

---

## 3. Files removed

| Path                                           | Reason                                          |
| ---------------------------------------------- | ----------------------------------------------- |
| `apps/mobile/lib/ui/dashboard_screen.dart`     | Dead / superseded by Home shell                 |
| `apps/web/src/components/Subnav.tsx`           | Unused                                          |
| `apps/web/src/lib/offline/OfflineAware.tsx`    | Unused                                          |
| `go_router` dependency (`pubspec.yaml` / lock) | Unused routing package                          |
| Dead helpers in `connections_controller.dart`  | `_persistAll`, `_seedSessions`, `_seedActivity` |
| Dead demo seeds in `security_controller.dart`  | `_demoDevices` / sessions / dapps / alerts      |

Net: **~563 lines removed** in this Prompt 1 diff (plus prior uncommitted cleanup).

---

## 4. Errors fixed

| Issue                                      | Resolution                                                   |
| ------------------------------------------ | ------------------------------------------------------------ |
| Connections tests expected seeded sessions | Updated for empty Closed Beta boot + explicit approve helper |
| Flutter analyze unused_element warnings    | Removed dead seed/persist helpers                            |
| Prefer-const / RadioListTile deprecations  | Const SoftBanner/SwitchListTile; `RadioGroup` wrapper        |
| Android Gradle placeholder TODOs           | Replaced with Closed Beta signing note                       |
| Web companion stale copy                   | sessionStorage + preview CTA honesty                         |

**Verified:** `flutter analyze` → **No issues found** · `flutter test` → **63 passed** · `@auvora/web` typecheck + eslint → **pass** · `pnpm --filter @auvora/web build` → **pass**

---

## 5. Performance improvements

- Removed unused `go_router` from mobile dependency graph
- Splash: no animation work when reduce-motion is on; bootstrap already avoids cosmetic splash delay
- Deleted unused dashboard / web Subnav / OfflineAware (smaller surface, less dead import risk)
- Const constructors where analyzer flagged hot paths / widgets

---

## 6. Security improvements

- Connections no longer invent connected dApps on first launch (honesty + reduced false trust)
- Security controller no longer carries unused demo identity data
- Gradle TODOs clarified: release still uses debug signing until store/CI keys are provisioned (called out, not silent)
- Foundation already in place (secure storage, fail-closed PIN gates, clipboard/screenshot guards from prior RM work) — verified present, not re-implemented

---

## 7. Remaining work (Prompt 2+)

| Priority | Item                                                                            |
| -------- | ------------------------------------------------------------------------------- |
| P0       | BIP32 HD derivation (replace `DerivationMode.previewSha`)                       |
| P0       | Live blockchain adapters + audited broadcast kill-switch flip                   |
| P0       | Argon2id (or equivalent) PIN KDF upgrade                                        |
| P1       | Produce iOS IPA on macOS + Xcode; wire CI for both stores                       |
| P1       | Provision Android release signing (replace debug `signingConfig`)               |
| P1       | Upgrade `mobile_scanner` / `share_plus` before Flutter drops plugin-applied KGP |
| P1       | Deduplicate web routes (`/portfolio` vs `/market/portfolio`, security paths)    |
| P2       | Wire crash reporting or keep honesty label; iOS screenshot protection           |
| P2       | Device / a11y matrix for Public Beta gate                                       |

**Do not rebuild** onboarding, Home, Security Center, Settings, Send/Receive, or beta feedback — improve in place.

---

## 8. Build status (software)

| Gate                            | Result                                                                   |
| ------------------------------- | ------------------------------------------------------------------------ |
| Flutter analyze                 | **PASS** — No issues found                                               |
| Flutter unit tests              | **PASS** — 63/63                                                         |
| Web TypeScript                  | **PASS**                                                                 |
| Web ESLint                      | **PASS**                                                                 |
| Web `next build`                | **PASS**                                                                 |
| Local Postgres / Prisma migrate | **N/A this session** — `localhost:5432` unreachable (Docker unavailable) |
| Node engines                    | Warn only — package wants 22.x, host ran 24.x                            |

---

## 9. Android status

| Check                                                                    | Result                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Project config (`android/`, `applicationId`, min/target SDK via Flutter) | Present / valid                                                                                  |
| Toolchain bootstrap this session                                         | OpenJDK 17 + Android cmdline-tools + SDK 34/35/36 + build-tools + NDK                            |
| `flutter build apk --release`                                            | **PASS** — `apps/mobile/build/app/outputs/flutter-apk/app-release.apk` (**70.4MB**)              |
| Release signing                                                          | Debug keys (Closed Beta internal); store/upload keys not provisioned                             |
| Notes                                                                    | KGP warning from `mobile_scanner` / `share_plus` (non-fatal); Flutter auto-installed Platform 36 |

```bash
# Reproduce
cd apps/mobile
flutter config --android-sdk %LOCALAPPDATA%\Android\Sdk
flutter build apk --release
```

---

## 10. iOS status

| Check                                                               | Result                                                                                                         |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Project (`ios/`, Info.plist Face ID / camera strings, display name) | Present / valid                                                                                                |
| `flutter build ios` on this Windows host                            | **BLOCKED** — iOS target unavailable (`Could not find an option named "--release"` / no macOS+Xcode toolchain) |

**Unblock (on Mac):**

```bash
cd apps/mobile
flutter build ios --release --no-codesign   # or full signing with team profile
```

---

## 11. Web status

| Check                                 | Result                                      |
| ------------------------------------- | ------------------------------------------- |
| `pnpm --filter @auvora/web typecheck` | **PASS**                                    |
| `pnpm --filter @auvora/web lint`      | **PASS**                                    |
| `pnpm --filter @auvora/web build`     | **PASS** (static + dynamic routes compiled) |

---

## Prompt 1 deliverable checklist

| Requirement                                                                  | Status                                                         |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Successful production-oriented software builds (web + Flutter analyze/tests) | **Met**                                                        |
| Successful Android APK on this machine                                       | **Met** (`app-release.apk` 70.4MB)                             |
| Successful iOS build on this machine                                         | **Blocked — Windows host** (iOS project present; build on Mac) |
| Successful web build                                                         | **Met**                                                        |
| No TS / lint / Flutter analyzer errors                                       | **Met**                                                        |
| Working onboarding / create / import / dashboard shell (code + tests)        | **Met** (existing flows retained; honesty polish applied)      |

**Prompt 2 gate:** Software + Android release artifact gates for Prompt 1 are green. iOS binary still needs a macOS runner — do not treat that as an app-code defect. Ready for Prompt 2 after acknowledging the iOS host constraint.

---

## Self-review (senior / UX / security / QA / a11y)

- **Senior mobile:** Correct to delete seeded Web3 sessions; tests now match product truth.
- **UX:** Closed Beta copy reduces false confidence on Buy/Sell/Receive.
- **Security:** Empty connections boot + fail-closed paths preserved; PIN still not Argon2id (tracked).
- **QA:** 63 tests green; Android/iOS install matrix still outstanding.
- **A11y:** Splash reduce-motion respected; RadioGroup migration avoids deprecated radio API.
