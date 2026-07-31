# Store Readiness Report — Version 1.0 Alpha

**Product:** Auvora Wallet  
**Version:** `1.0.0-alpha.1` (+5 mobile)  
**Date:** 2026-07-31  
**Scope:** Structural readiness for _future_ App Store / Google Play submission. **Not** a production store submission package.

---

## Identifiers

| Field                           | Value                                     | Status                                           |
| ------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| Application name                | Auvora Wallet                             | Ready                                            |
| Android `applicationId`         | `com.auvora.auvora_wallet`                | Ready                                            |
| iOS `PRODUCT_BUNDLE_IDENTIFIER` | `com.auvora.auvoraWallet`                 | Ready (platform-conventional casing)             |
| Marketing version               | `1.0.0-alpha.1`                           | Ready                                            |
| Android / iOS build number      | `5` (from `pubspec` `+5`)                 | Ready                                            |
| Website                         | `https://wallet.auvora.app`               | Configured — **host content**                    |
| Privacy policy                  | `https://wallet.auvora.app/legal/privacy` | Configured — also served on web `/legal/privacy` |
| Terms of service                | `https://wallet.auvora.app/legal/terms`   | Configured — also served on web `/legal/terms`   |
| Support contact                 | `alpha@auvora.app`                        | Configured — **mailbox must be monitored**       |

> Note: Android and iOS package IDs intentionally differ in casing (`auvora_wallet` vs `auvoraWallet`). Do not “unify” without a coordinated migration plan.

---

## Android checklist

| Item                                                     | Status                                                  |
| -------------------------------------------------------- | ------------------------------------------------------- |
| App icon (mipmap densities)                              | Present                                                 |
| Adaptive icon (API 26+)                                  | Present                                                 |
| Splash / launch background                               | Present                                                 |
| Permissions (Internet, Camera, Biometric, Notifications) | Declared                                                |
| Notification channels                                    | Created in `MainActivity`                               |
| Deep links (`auvora://`, `wc:`, HTTPS path prefixes)     | Present; `autoVerify` deferred                          |
| Back button / `singleTop` launch mode                    | Present                                                 |
| `allowBackup=false`                                      | Present                                                 |
| Network security (cleartext off)                         | Present                                                 |
| Release signing (`key.properties`)                       | Optional — missing → debug sign                         |
| AAB / APK release artifacts                              | Built when Flutter+SDK available (see Prompt 10 report) |
| Feature graphic (Play)                                   | **Placeholder needed** — 1024×500 marketing asset       |
| Play Console Data safety / content rating                | Operator task                                           |

---

## iOS checklist

| Item                                 | Status                                                               |
| ------------------------------------ | -------------------------------------------------------------------- |
| Display name                         | Auvora Wallet                                                        |
| Launch screen storyboard             | Present                                                              |
| Camera usage description             | Present                                                              |
| Face ID usage description            | Present                                                              |
| URL schemes (`auvora`, `wc`)         | Present                                                              |
| Flutter deep linking enabled         | Present                                                              |
| `ITSAppUsesNonExemptEncryption`      | `false`                                                              |
| Query schemes (https/http/mailto)    | Present                                                              |
| App icons (Asset Catalog)            | Flutter default set — **replace with branded set before TestFlight** |
| Universal Links / Associated Domains | **Not yet** — needs entitlement + `apple-app-site-association`       |
| Push capability                      | Not required for Alpha (no push SDK)                                 |
| Background modes                     | None beyond Flutter defaults                                         |
| IPA / Archive                        | **Requires macOS**                                                   |

---

## Metadata still missing for production store

1. Play feature graphic + phone/tablet screenshots
2. App Store screenshots (6.7", 6.5", iPad)
3. Short / long store descriptions (localized)
4. Age rating questionnaires completed in consoles
5. Hosted privacy/terms at the exact public URLs above
6. Upload keystore + Apple distribution certificates
7. Digital Asset Links + Associated Domains for verified HTTPS links

---

## Verdict

| Track                                | Verdict                                    |
| ------------------------------------ | ------------------------------------------ |
| Closed Alpha sideload / internal web | **READY** (with funding/broadcast locks)   |
| Play internal testing                | **NEAR** — needs upload keystore + listing |
| App Store TestFlight                 | **BLOCKED** on macOS + Apple assets        |
| Production store                     | **NOT READY**                              |

See also: [`ALPHA_1.0_LAUNCH_CHECKLIST.md`](ALPHA_1.0_LAUNCH_CHECKLIST.md), [`APP_STORE_RELEASE.md`](APP_STORE_RELEASE.md).
