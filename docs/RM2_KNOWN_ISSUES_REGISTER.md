# Known Issues Register — RM2 Closed Beta / RC1

**Product:** Auvora Wallet  
**Build:** `1.1.0-rc.1` (`closed-beta` · RC1)  
**Updated:** 2026-07-31

Severity legend: **C** Critical · **H** High · **M** Medium · **L** Low

---

## Critical (open — block Public Beta / live funding)

| ID     | Impact                                                          | Root cause                                          | Resolution                                                                                             | Regression       |
| ------ | --------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------- |
| KI-C01 | Funding before off-device HD verification risks wrong addresses | BIP32/SLIP-0010 active; not yet verified off-device | Keep `allowFundingAddresses=false`; RC1 **disables QR/copy/share**; verify HD externally before unlock | Mitigated in RC1 |
| KI-C02 | No live broadcast                                               | `PreviewBlockchainAdapter` + kill switch            | `liveBroadcastEnabled=false`; audited adapters required                                                | Open             |
| KI-C03 | PIN KDF not Argon2id                                            | Iterated SHA-256 v2                                 | Constant-time compare landed; Argon2id pending                                                         | Open             |

## High (open)

| ID     | Impact                        | Root cause                       | Resolution                                                 | Regression                          |
| ------ | ----------------------------- | -------------------------------- | ---------------------------------------------------------- | ----------------------------------- |
| KI-H01 | Device matrix unsigned        | No physical lab pass this cycle  | QA device matrix before Public Beta                        | Open                                |
| KI-H02 | VoiceOver/TalkBack incomplete | Partial a11y wiring              | Dedicated a11y sprint                                      | Open (SoftBanner liveRegion in RC1) |
| KI-H03 | Web JWT still client-held     | sessionStorage migration only    | Prefer httpOnly BFF cookies                                | Mitigated                           |
| KI-H04 | Crash reporter SDK unwired    | Prefs without Sentry/Crashlytics | Toggle disabled in RC1 (honest); wire SDK or keep disabled | Mitigated in RC1                    |
| KI-H05 | iOS screenshot guard missing  | Android FLAG_SECURE only         | iOS ScreenCapture API                                      | Open                                |

## Medium (open)

| ID     | Impact                             | Root cause                          | Resolution                             | Regression                          |
| ------ | ---------------------------------- | ----------------------------------- | -------------------------------------- | ----------------------------------- |
| KI-M01 | Full l10n not shipped              | EN-only Material localizations      | ARB language packs                     | Open                                |
| KI-M02 | Dark muted not fully swept         | Some hardcoded `AetherColors.muted` | Continue `mutedFor` migration          | Open (Receive/Home sheet fixed RC1) |
| KI-M03 | Chip touch targets                 | Material defaults                   | Theme `chipTheme` + padded ChoiceChips | Mitigated in RC1                    |
| KI-M04 | Physical offline stress incomplete | Lab not run                         | Network matrix                         | Open                                |
| KI-M05 | Android APK debug-signed           | No release keystore in CI           | Document; store signing before Play    | Open                                |
| KI-M06 | OS background sync not wired       | Foreground-only coordinator         | WorkManager / BGTask later             | Open                                |

## Low (open)

| ID     | Impact                               | Root cause      | Resolution                 | Regression       |
| ------ | ------------------------------------ | --------------- | -------------------------- | ---------------- |
| KI-L01 | Activity web mild design drift       | Parallel shells | Design sync                | Open             |
| KI-L02 | Advanced flags are local-only        | Intentional     | Label remains              | Accepted         |
| KI-L03 | Auto-lock on every pause feels harsh | Security-first  | Tunable grace period later | Accepted for RC1 |

## Resolved in RM2 / RC1

| ID     | Severity | Impact                                | Resolution                                                   | Regression |
| ------ | -------- | ------------------------------------- | ------------------------------------------------------------ | ---------- |
| KI-R01 | H        | Feedback was sheet theater            | Structured Beta feedback (mobile + web)                      | Pass       |
| KI-R02 | H        | Clipboard clear unwired               | `copyTextSecure` + timeout                                   | Pass       |
| KI-R03 | H        | Screenshot toggle theater             | Android FLAG_SECURE channel                                  | Pass       |
| KI-R04 | H        | Balance reveal auth unwired           | Biometrics/PIN gate on Home eye                              | Pass       |
| KI-R05 | C        | Funding QR available on preview       | Receive **QR/copy/share disabled** when funding locked (RC1) | Pass       |
| KI-R06 | H        | Preview send mutated balances as live | Balance rewrite gated on live broadcast                      | Pass       |
| KI-R07 | H        | JWT in localStorage                   | Migrated to sessionStorage                                   | Pass       |
| KI-R08 | M        | PIN timing compare                    | Constant-time equals                                         | Pass       |
| KI-R09 | H        | Asset detail clipboard bypass         | Copy locked or routes through `copyText` (RC1)               | Pass       |
| KI-R10 | M        | SoftBanner not announced              | Semantics liveRegion (RC1)                                   | Pass       |
| KI-R11 | M        | Crash toggle implied live reporting   | Disabled + honest copy (RC1)                                 | Pass       |

---

Maintainers: update this file on every Closed Beta / RC hotfix. Move rows only after verified regression status.
