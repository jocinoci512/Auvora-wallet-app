# RM2 — Closed Beta Readiness Report

**Product:** Auvora Wallet  
**Milestone:** Release Milestone 2 (RM2) — Closed Beta / Real-World Validation  
**Build:** `1.1.0-beta.1` · channel `closed-beta`  
**Date:** 2026-07-30

---

## Executive decision

| Gate                                                                  | Verdict                 |
| --------------------------------------------------------------------- | ----------------------- |
| **Closed Beta (trusted cohort, simulated networks, no real funding)** | **CONDITIONAL APPROVE** |
| **Public Beta (real assets / open invite)**                           | **REJECT**              |
| **Closed Beta readiness score**                                       | **71 / 100**            |

Self-check:

| Question                            | Answer                                                      |
| ----------------------------------- | ----------------------------------------------------------- |
| Trust with family's digital assets? | **No** — funding/broadcast remain locked                    |
| Invite 1,000 beta testers?          | **Not yet** — invite ≤50 trusted testers on simulated rails |
| Major risks understood?             | **Yes** — register in `RM2_KNOWN_ISSUES_REGISTER.md`        |
| Product feel mature?                | **Partially** — journeys polish; crypto rails incomplete    |

---

## What RM2 delivered

### Beta feedback framework

- Mobile: More → Beta feedback; Help/About entry points
- Categories: Bug · Suggestion · Confusing UX · Performance · Security · Accessibility
- Optional diagnostics **only with explicit consent**; never keys/phrases
- Local store + share/copy (no silent upload)
- Web: `/settings/feedback`

### Hard gates (life-savings protection)

- `ReleaseConfig.allowFundingAddresses = false` — Receive locked for funding
- `ReleaseConfig.liveBroadcastEnabled = false` — kill switch for live broadcast
- Preview sends no longer rewrite balances as if confirmed

### Privacy / security hardening

- Clipboard auto-clear wired to prefs + Security timeout
- Android `FLAG_SECURE` via MethodChannel when screenshot protection enabled
- Balance reveal requires auth when privacy toggle is on
- PIN verify uses constant-time compare
- Web access tokens moved from `localStorage` → `sessionStorage` (legacy migrated)

### Localization scaffold

- Material/Cupertino/Widgets localizations + `en` supported locale (ARB expansions next)

### Release packaging

- Version bump `1.1.0+2`
- About screen reflects Closed Beta channel + funding warning

---

## Validation reports (summary)

### Crash resilience

| Scenario                      | Status                            |
| ----------------------------- | --------------------------------- |
| Background resume → auto-lock | Covered (RM1 + retained)          |
| Auth cancel / PIN failure     | Soft fail + lockout               |
| Interrupted send              | Double-tap guard + mounted checks |
| Memory / OS kill              | Not lab-profiled this cycle       |
| Permission denial             | Soft banners; no crash expected   |

**Crash report:** No new crashers found in unit suite. Physical stress matrix **open** (KI-H01).

### Performance

| Metric                     | Status                                                  |
| -------------------------- | ------------------------------------------------------- |
| Startup                    | Cache-first retained; cold-start counter in Diagnostics |
| Navigation / reduce-motion | Wired                                                   |
| Sync / offline             | Retry + SoftBanner Retry                                |
| Battery / Instruments      | Not measured on device this cycle                       |

**Performance report:** Acceptable for Closed Beta simulated use. Production targets need device traces.

### Security validation

| Area                  | Status                                                    |
| --------------------- | --------------------------------------------------------- |
| Key storage           | Secure storage + session lock                             |
| Recovery phrase       | Reveal gated; backup copy honest                          |
| PIN                   | Weak denylist + lockout + constant-time; **not Argon2id** |
| Biometrics            | Onboarding-safe toggle                                    |
| WalletConnect         | Preview permissions                                       |
| Logging / diagnostics | Feedback diagnostics scrubbed                             |
| Dependencies          | Audit still open                                          |

### Accessibility validation

| Area                 | Status                          |
| -------------------- | ------------------------------- |
| Reduce motion        | Prefs → runtime                 |
| Touch targets        | Partial 48×48                   |
| Contrast             | Helper exists; sweep incomplete |
| VoiceOver / TalkBack | Not fully signed                |
| Dynamic type         | Text scale slider               |

### Compatibility

| Surface                | Status                                   |
| ---------------------- | ---------------------------------------- |
| Phone / tablet layouts | Responsive shells present                |
| Landscape              | Allowed in orientation lock list         |
| Desktop companion      | Web Closed Beta feedback + session token |
| Low-memory Android     | Not lab-tested                           |

---

## Critical blockers (Public Beta)

1. BIP32 / ed25519 HD derivation + unlock funding
2. Audited live broadcast adapters + kill-switch ops
3. Argon2id (or Keystore-bound) PIN
4. Signed device + a11y matrix
5. Crash reporter wired to consent (or remove claim)
6. Web httpOnly session model for any privileged API

## Recommended fixes (next)

1. Ethereum BIP44 derivation spike → parity tests vs MetaMask
2. Feature-flagged eth broadcast on testnet only
3. Argon2id migrate-on-login
4. 3-day device + a11y lab
5. npm/pub audit in CI

---

## Closed Beta tester brief (mandatory)

1. **Do not send real funds** — Receive is locked; addresses are preview.
2. Send/Swap/Bridge are **device previews**; live broadcast is off.
3. Use **Beta feedback** for bugs/UX/security/a11y; share reports intentionally.
4. Web companion is not a custodian.
5. Cohort size: trusted testers only until Public Beta gates clear.

---

## Recommendation

|                 |                                                                                         |
| --------------- | --------------------------------------------------------------------------------------- |
| **Closed Beta** | **CONDITIONAL APPROVE** for ≤50 trusted testers on simulated rails with the brief above |
| **Public Beta** | **REJECT** until KI-C01…C03 and device/a11y gates clear                                 |

Would leadership ship this to family with real money? **No.**  
Would leadership run a closed simulated-network validation cohort? **Yes.**
