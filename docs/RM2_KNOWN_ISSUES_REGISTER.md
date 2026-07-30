# Known Issues Register — RM2 Closed Beta

**Product:** Auvora Wallet  
**Build:** 1.1.0-beta.1 (`closed-beta`)  
**Updated:** 2026-07-30

Severity legend: **C** Critical · **H** High · **M** Medium · **L** Low

---

## Critical (open — block Public Beta)

| ID     | Impact                                             | Root cause                               | Resolution                                                                | Regression |
| ------ | -------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- | ---------- |
| KI-C01 | Addresses are not BIP32; funding would lose assets | SHA-256 preview derivation               | Keep `allowFundingAddresses=false`; ship BIP32/ed25519 before Public Beta | Open       |
| KI-C02 | No live broadcast                                  | `PreviewBlockchainAdapter` + kill switch | `liveBroadcastEnabled=false`; audited adapters required                   | Open       |
| KI-C03 | PIN KDF not Argon2id                               | Iterated SHA-256 v2                      | Constant-time compare landed; Argon2id pending                            | Open       |

## High (open)

| ID     | Impact                         | Root cause                       | Resolution                           | Regression |
| ------ | ------------------------------ | -------------------------------- | ------------------------------------ | ---------- |
| KI-H01 | Device matrix unsigned         | No physical lab pass this cycle  | QA device matrix before Public Beta  | Open       |
| KI-H02 | VoiceOver/TalkBack incomplete  | Partial a11y wiring              | Dedicated a11y sprint                | Open       |
| KI-H03 | Web JWT still client-held      | sessionStorage migration only    | Prefer httpOnly BFF cookies          | Mitigated  |
| KI-H04 | Crash reporter consent unwired | Prefs without Sentry/Crashlytics | Wire reporter or remove toggle label | Open       |
| KI-H05 | iOS screenshot guard missing   | Android FLAG_SECURE only         | iOS ScreenCapture API                | Open       |

## Medium (open)

| ID     | Impact                             | Root cause                     | Resolution                    | Regression |
| ------ | ---------------------------------- | ------------------------------ | ----------------------------- | ---------- |
| KI-M01 | Full l10n not shipped              | EN-only Material localizations | ARB framework next            | Open       |
| KI-M02 | Dark muted not fully swept         | Hardcoded `AetherColors.muted` | Continue `mutedFor` migration | Open       |
| KI-M03 | Chip touch targets <48dp           | Material defaults              | Theme overlay                 | Open       |
| KI-M04 | Physical offline stress incomplete | Lab not run                    | Network matrix                | Open       |

## Low (open)

| ID     | Impact                         | Root cause      | Resolution    | Regression |
| ------ | ------------------------------ | --------------- | ------------- | ---------- |
| KI-L01 | Activity web mild design drift | Parallel shells | Design sync   | Open       |
| KI-L02 | Advanced flags are local-only  | Intentional     | Label remains | Accepted   |

## Resolved in RM2

| ID     | Severity | Impact                                | Resolution                              | Regression |
| ------ | -------- | ------------------------------------- | --------------------------------------- | ---------- |
| KI-R01 | H        | Feedback was sheet theater            | Structured Beta feedback (mobile + web) | Pass       |
| KI-R02 | H        | Clipboard clear unwired               | `copyTextSecure` + timeout              | Pass       |
| KI-R03 | H        | Screenshot toggle theater             | Android FLAG_SECURE channel             | Pass       |
| KI-R04 | H        | Balance reveal auth unwired           | Biometrics/PIN gate on Home eye         | Pass       |
| KI-R05 | C        | Funding QR available on preview       | Receive locked via `ReleaseConfig`      | Pass       |
| KI-R06 | H        | Preview send mutated balances as live | Balance rewrite gated on live broadcast | Pass       |
| KI-R07 | H        | JWT in localStorage                   | Migrated to sessionStorage              | Pass       |
| KI-R08 | M        | PIN timing compare                    | Constant-time equals                    | Pass       |

---

Maintainers: update this file on every Closed Beta hotfix. Move rows only after verified regression status.
