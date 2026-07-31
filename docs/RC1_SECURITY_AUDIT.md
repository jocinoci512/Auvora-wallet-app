# RC1 Security Audit Report

**Build:** `1.1.0-rc.1` · 2026-07-31  
**Scope:** Closed Beta / Alpha candidate — simulated rails  
**Verdict:** **PASS for Closed Alpha** · **FAIL for live funding / Public Beta**

---

## Executive summary

Kill switches remain off. RC1 closes the residual practice-Receive hole by disabling QR, copy, and share while funding is locked. Auth for send and Web3 stays fail-closed. No high-severity issue allows silent live broadcast or silent funding in intended use.

---

## Controls verified

| Control                                             | Result                          |
| --------------------------------------------------- | ------------------------------- |
| `liveBroadcastEnabled=false`                        | Pass (compile-time + unit test) |
| `allowFundingAddresses=false`                       | Pass; UI disables QR/copy/share |
| Preview adapter `preview: true`                     | Pass                            |
| SecureKeyStore (OS encrypted)                       | Pass                            |
| PIN lockout + weak denylist + constant-time compare | Pass                            |
| Send requires PIN; WC approve requires auth         | Pass                            |
| Offline queue refuses sign/send                     | Pass                            |
| Diagnostics / feedback scrub secrets                | Pass                            |
| Crash reporting disabled (no SDK)                   | Pass                            |

---

## Findings

### Critical — mitigated for Closed Beta

- **KI-C01:** HD addresses exist; funding unlock still blocked; RC1 removes scannable funding surface.
- **KI-C02:** Live broadcast off — intentional.

### High — open (documented)

- **KI-C03:** PIN KDF not Argon2id.
- **KI-H05:** iOS screenshot guard missing.
- **KI-H03:** Web JWT in sessionStorage (mitigated vs localStorage).
- **KI-H01:** Physical device matrix unsigned.

### Medium

- Android APK debug-signed (KI-M05).
- TransactionEngine relies on Preview adapter wiring (keep kill switch + adapter contract).

---

## Secrets & logging

- No private keys in diagnostics JSON.
- Send error path filters mnemonic/seed/private substrings.
- Beta feedback optional diagnostics remain scrubbed.

---

## Dependency posture

- Flutter/plugin updates available but constrained; no emergency CVE triage performed this cycle.
- Recommend `flutter pub outdated` + Dependabot before Public Beta.

---

## Recommendation

**Approve** security posture for Closed Alpha with no real funds.  
**Do not approve** for custody of significant digital assets until live adapters, Argon2id, HD off-device verify, and iOS screenshot guard land.
