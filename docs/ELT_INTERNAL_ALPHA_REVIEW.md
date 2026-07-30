# ELT Review Board — Internal Alpha Decision

**Date:** 2026-07-30  
**Board:** CEO · CPO · CTO · CISO · Head of Design · QA Lead · Accessibility Specialist · Mobile Engineering Lead  
**Product:** Auvora Wallet — Release Milestone 1

---

## Decision

| Gate                                                           | Verdict                                        |
| -------------------------------------------------------------- | ---------------------------------------------- |
| **Internal Alpha (closed engineering / trusted stakeholders)** | **CONDITIONAL APPROVAL**                       |
| **Closed Beta (friends & family / real assets)**               | **REJECTED**                                   |
| **Board confidence score**                                     | **78 / 100** (was 72 before this review cycle) |

Internal Alpha may proceed **only** with the mandatory tester brief below.  
The board will **not** approve Closed Beta until the prioritized action plan is complete.

---

## Board statements (condensed)

| Role                | Verdict                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **CEO**             | Approves Internal Alpha for demonstration with honest preview framing. Rejects any narrative that Auvora already custodies live funds.    |
| **CPO**             | Trust eroded where UI overclaimed (“securely submitted”, fake devices, decorative toggles). Fixes landed; journeys now clearer.           |
| **CTO**             | Architecture acceptable for Alpha. Preview adapters must remain labeled until BIP32 + broadcast exist.                                    |
| **CISO**            | Critical fail-open and theater issues found and fixed this cycle. Still insufficient for real assets (KDF, web JWT, non-BIP32 addresses). |
| **Head of Design**  | Consistency improved; dark muted / jargon / empty QR addressed on priority surfaces. Full design QA still due.                            |
| **QA Lead**         | Unit suite green (+59). Device matrix and network interruption matrix still open.                                                         |
| **Accessibility**   | Reduce-motion prefs now wire to runtime; gaps remain (chips, high-contrast enforcement, full SR pass).                                    |
| **Mobile Eng Lead** | `changePin` regression was ship-blocking; fixed and guarded by test. Biometrics no longer ejects to onboarding.                           |

---

## Issues found → fixed this review

| #   | Severity | Why it mattered                                             | Fix                                                               |
| --- | -------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Critical | Send said “securely submitted” on preview rails             | Honest “Transfer preview recorded” + warn banner                  |
| 2   | Critical | Receive QR could encode empty / funds to wrong derivation   | No QR until address exists; Alpha “do not send real funds” banner |
| 3   | High     | `changePin` regex always failed                             | Correct `^\d{6}$` + regression test                               |
| 4   | High     | Biometrics toggle forced Permissions stage                  | Only advance during onboarding biometric stage                    |
| 5   | High     | Security checkup marked backup/devices/app without auth     | All checkup mutations require `_authenticateSensitive`            |
| 6   | High     | Fake “Unknown desktop/browser” inflated score               | This-device-only defaults; no synthetic unknowns                  |
| 7   | High     | Session unlocked before PIN after import                    | `setSessionUnlocked(false)` until unlock/finish                   |
| 8   | High     | No auto-lock on background                                  | Lock on `AppLifecycleState.paused` when dashboard unlocked        |
| 9   | High     | Unlimited PIN attempts                                      | Backoff lockout after 5 failures                                  |
| 10  | High     | Weak PIN allowed at setup; Change PIN denylist inconsistent | Weak PIN denylist on `setPin` / `changePin`                       |
| 11  | High     | Backup claimed “never stores” phrase                        | Accurate secure-storage + paper-backup copy                       |
| 12  | Medium   | `requireAuthForSend` switch was theater                     | Locked on + honest subtitle                                       |
| 13  | Medium   | Accessibility reduce-motion didn’t drive animations         | Prefs → `WalletController.setReduceMotion` (persisted)            |
| 14  | Medium   | Passcode dots ignored app reduce-motion                     | Watches `WalletController.reduceMotion`                           |
| 15  | Medium   | Import overclaimed “securely”; phrase lingered in field     | CTA softened; controller cleared after commit                     |
| 16  | Medium   | Security score assumed app updated                          | Default `appUpdated = false`                                      |
| 17  | Medium   | Demo dapps/alerts invented risk                             | Empty until real connections/alerts exist                         |
| 18  | Medium   | Web Send/Swap “Authenticate” theater; ENS invents addresses | Confirm-preview CTAs; demo-resolve disclosure                     |
| 19  | Medium   | Web indexed as production wallet                            | `robots: noindex`; Alpha companion metadata                       |
| 20  | Low      | Networks jargon / ALL-CAPS                                  | Friendly labels; keep stable IDs                                  |

### Verification

- `flutter test` — **All tests passed** (59)
- `npx tsc --noEmit` — clean (web)

---

## Mandatory Internal Alpha tester brief

Distribute with every Alpha build:

1. **Do not send real funds** to any address shown in this build.
2. Addresses are **preview-derived**, not BIP32/MetaMask-compatible.
3. Send / Swap / Bridge are **device simulations**, not chain broadcasts.
4. Web is a **companion**, not a signing custodian.
5. Report anything that feels “live” when it isn’t.

---

## Prioritized action plan before Closed Beta

### P0 — Must complete (blockers)

1. **Real HD derivation** (BIP32/BIP44 / ed25519) + receive hard-gate until ready
2. **Live broadcast path** behind feature flag with kill switch; remove local “balance decrement as if confirmed” theater or mark explicitly
3. **Argon2id (or platform Keystore-bound) PIN** + constant-time compare; retire legacy hash
4. **Web:** remove long-lived JWT from `localStorage` **or** permanently disable web signing/auth claims
5. **Physical device matrix** (small/large Android/iOS, rotation, background lock) signed by QA
6. **TalkBack / VoiceOver + WCAG sample** on Send, Receive, Unlock, Security Center

### P1 — High priority

7. Wire remaining a11y prefs (haptics, large targets, high contrast) to runtime
8. Sweep `AetherColors.muted` → `mutedFor(context)` + dark border helper
9. Enforce 48×48 on chips / SoftBanner actions / send paste
10. Dependency audit (`flutter pub outdated`, `npm audit`) in CI
11. Secure logging review (zero mnemonic/PIN in logs/crash payloads)
12. Support / security intake channel for beta cohort

### P2 — Before public beta

13. Full design consistency pass (welcome vs splash, activity web drift)
14. Offline / airplane / flaky-network stress suite
15. Pen-test of unlock, phrase reveal, WalletConnect permissions

---

## Production readiness by dimension

| Dimension            | Score | Notes                                             |
| -------------------- | ----- | ------------------------------------------------- |
| Product quality      | 7/10  | Broad surface; honesty restored on money paths    |
| Trust                | 7/10  | Theater removed from Security/Send; still preview |
| Simplicity           | 7/10  | Microcopy improved; some Settings density remains |
| Security             | 6/10  | Fail-closed improved; crypto rails not production |
| Performance          | 7/10  | Fake delays gone; profiling incomplete            |
| Accessibility        | 6/10  | Motion wired; incomplete AA claim                 |
| Visual consistency   | 7/10  | Language unified; dark sweep incomplete           |
| Maintainability      | 8/10  | Controllers coherent; PIN dual-path documented    |
| Production readiness | 5/10  | Alpha only                                        |

---

## Final board vote

**Internal Alpha: APPROVED with conditions** (tester brief + no real funds).  
**Closed Beta: NOT APPROVED** — execute P0 list, then reconvene.

Would the board install this on a work phone today? **Yes — for Alpha QA.**  
Would the board trust it with personal assets? **No.**  
Would the board show investors? **Yes — with the preview brief on-screen.**  
Would the board recommend to family? **No until Closed Beta gates clear.**
