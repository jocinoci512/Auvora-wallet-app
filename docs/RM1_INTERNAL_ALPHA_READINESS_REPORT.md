# RM1 — Internal Alpha Readiness Report

**Product:** Auvora Wallet  
**Milestone:** Release Milestone 1 (RM1) — Internal Alpha / Production Hardening  
**Date:** 2026-07-30  
**Scope:** Polish, reliability, security, accessibility — **no new major features**

---

## Executive verdict

| Decision                    | Result                                        |
| --------------------------- | --------------------------------------------- |
| **Internal Alpha**          | **APPROVED** for closed internal testers      |
| **Closed Beta**             | **REJECTED** until blockers below are cleared |
| **Overall readiness score** | **78 / 100**                                  |

Internal Alpha is appropriate for engineering, design, and trusted stakeholders exercising preview rails. It is **not** ready for friends-and-family Closed Beta with real assets.

Self-check answers for this build:

| Question                       | Answer                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Install on my own phone today? | **Yes** — for preview / Internal Alpha only                                          |
| Trust with my own assets?      | **No** — live signing/broadcast not production-grade; web PIN/JWT model remains weak |
| Demonstrate to investors?      | **Yes** — with honest “preview network / companion” framing                          |
| Recommend to family?           | **No** until Closed Beta blockers clear                                              |

---

## Improvements implemented (this milestone)

### Critical / high — security

| Issue                                               | Fix                                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Security Center fail-open when no PIN               | Fail closed — sensitive actions require PIN                                         |
| Auto-unlock to dashboard without PIN                | Force `AppStage.securityPin` when vault exists but PIN missing                      |
| Legacy plaintext mnemonic key after migrate         | Delete `auvora_mnemonic_v1` after successful migrate                                |
| iOS Keychain options incomplete                     | Applied on `SecureKeyStore` + wallet secure storage                                 |
| Preview signer hashed mnemonic into digest          | Sign digest uses `fromAddress` + payload only                                       |
| Artificial adapter delays                           | Removed from balance / history / sign / broadcast / ping paths                      |
| Backup phrase revealed by default                   | `_revealed = false` until user taps Show                                            |
| `updateSecurityMetadata` read mnemonic while locked | Requires `_sessionUnlocked`; uses keystore only after session check                 |
| Send biometric confirm missing `mounted`            | Guard before `_submit()`                                                            |
| Weak single-pass PIN hash                           | Iterated SHA-256 v2 (`100k`) + legacy verify path; Argon2id deferred to Closed Beta |

### Medium — UX / a11y / microcopy

| Issue                                         | Fix                                                 |
| --------------------------------------------- | --------------------------------------------------- |
| Dark-mode muted contrast                      | `AetherColors.mutedOnDark` + `mutedFor(context)`    |
| Search rail IconButton & tip CTAs under 48×48 | Minimum touch targets raised                        |
| PIN dots ignore reduce-motion                 | `MediaQuery.disableAnimationsOf` → zero duration    |
| Verify quiz ignores reduce-motion             | Instant advance when reduce motion                  |
| Networks “RPC” jargon                         | Preview / network cache / custom endpoints wording  |
| Receipt “Hash”                                | “Transaction ID” in share receipt                   |
| Import missing guidance banner                | SoftBanner privacy warning + SoftBanner errors      |
| Biometrics toggle no loading state            | Busy flag + disabled switch + waiting copy          |
| Web privacy defaults opt-in telemetry/AI      | Crash, personalization, AI defaults **off**         |
| Send success overclaimed live submit          | “Transfer preview complete” + honest preview copy   |
| Send errors not announced                     | `role="alert"` on error banners                     |
| Help placeholder mailto inboxes               | Point to status / Security Center for Alpha         |
| Privacy “placeholder” destructive CTAs        | Honest Alpha copy (export/delete not available yet) |
| Diagnostics “RPC” label                       | “Network requests / failures”                       |

### Performance

- Removed fake latency from blockchain adapter preview paths (perceived sync/sign responsiveness).
- Prior Sprint 9 cache-first portfolio / sync coordinator retained (no regression intended).

### Observability / privacy

- Diagnostics remain device-local; copy reiterates keys/phrases never exported.
- Web crash reporting and AI surfaces default off until explicit consent.

---

## Complete issue log

### Fixed in RM1

1. SEC-01 Security Center auth fail-open
2. SEC-02 Dashboard unlock without PIN
3. SEC-03 Legacy mnemonic retention
4. SEC-04 iOS Keychain hardening
5. SEC-05 Mnemonic in preview signature digest
6. SEC-06 Session-unlocked gate for vault metadata writes
7. SEC-07 Backup phrase auto-reveal
8. SEC-08 PIN KDF strengthened (interim v2)
9. UX-01 Networks jargon
10. UX-02 Transaction receipt Hash wording
11. UX-03 Import SoftBanner guidance
12. UX-04 Biometrics toggle loading
13. UX-05 Send / Help / Privacy honesty on web
14. A11Y-01 Touch targets (search, tip CTA)
15. A11Y-02 Reduce motion on PIN dots & verify quiz
16. A11Y-03 Dark muted contrast helper
17. A11Y-04 Send error `role="alert"`
18. PERF-01 Fake adapter delays

### Remaining known issues (not blocking Internal Alpha)

| ID   | Severity          | Area         | Notes                                                                                                |
| ---- | ----------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| K-01 | Critical for Beta | Signing      | Live chain broadcast / real key derivation still preview                                             |
| K-02 | High              | Web security | Session JWT / weak web PIN in localStorage — not suitable for real funds                             |
| K-03 | High              | Crypto       | PIN should move to Argon2id (or platform Keystore-bound auth) before public beta                     |
| K-04 | Medium            | A11y         | Not all IconButtons globally audited to 48×48; dynamic type not fully verified                       |
| K-05 | Medium            | Design       | Residual muted color literals not yet all routed through `mutedFor`                                  |
| K-06 | Medium            | Device QA    | Physical device matrix (small/large Android/iOS, tablets, rotation) not executed in this environment |
| K-07 | Low               | Flutter CI   | Ensure CI uses `.tools/flutter` or documented PATH; local suite green in RM1                         |
| K-08 | Low               | Copy         | Advanced settings still expose “local placeholder” flags                                             |
| K-09 | Low               | Activity web | Mild design drift vs main wallet shell                                                               |
| K-10 | Low               | WCAG         | Full automated axe / TalkBack / VoiceOver pass pending                                               |

---

## Risk assessment

| Risk                                        | Likelihood | Impact | Mitigation                                         |
| ------------------------------------------- | ---------- | ------ | -------------------------------------------------- |
| Testers believe preview send is live        | Medium     | High   | Honest receipt copy; Internal Alpha brief          |
| PIN brute-force on stolen device            | Low–Med    | High   | v2 iterated hash; still need Argon2id + lockout UX |
| Web companion mistaken for custodial wallet | Medium     | High   | Framing: companion / review; mobile signs          |
| Unmigrated installs still on legacy PIN     | Medium     | Med    | Dual verify path; force re-set on next major       |
| Incomplete device a11y pass                 | High       | Med    | Schedule dedicated a11y day before Closed Beta     |
| Dependency / supply-chain CVE               | Unknown    | High   | Run `flutter pub outdated` + npm audit before Beta |

---

## Performance report

| Area               | Status               | Notes                                                                 |
| ------------------ | -------------------- | --------------------------------------------------------------------- |
| Startup            | Acceptable for Alpha | Short splash + reduce-motion aware; cold-start counter in Diagnostics |
| Navigation         | Acceptable           | Shell transitions respect reduce motion                               |
| Rendering          | Acceptable           | Cache-first portfolio paint (Sprint 9)                                |
| Network            | Preview              | Retries + partial chain sync; not live SLA                            |
| Artificial latency | Improved             | Adapter delays removed                                                |
| Profiling          | Incomplete           | No Instruments / systrace capture in this pass                        |

**Recommendation:** Capture cold start p50/p95 on two physical devices before Closed Beta gate.

---

## Security report

### Strengthened

- Fail-closed sensitive auth
- No dashboard without PIN when vault present
- Legacy mnemonic deletion after migrate
- iOS Keychain options
- Preview signatures exclude mnemonic material
- Session lock gates mnemonic reads for metadata updates
- Stronger PIN hashing (interim)
- Privacy / crash / AI opt-in defaults on web

### Explicit Alpha limitations

- Blockchain adapters are **preview** (deterministic / simulated rails)
- Web is a **companion**, not a production signing surface
- PIN KDF is **not** Argon2id yet
- No formal pen-test or dependency audit signed off in this milestone

### Closed Beta security gate (must pass)

1. Real derivation + broadcast path behind feature flag with kill switch
2. Argon2id (or platform-equivalent) PIN / biometric binding
3. Web: no long-lived secrets in localStorage; documented threat model
4. Secure logging review (no phrase/PIN/private key in logs)
5. Dependency audit + crash reporter privacy review

---

## Accessibility report

| Criterion                         | Status                                     |
| --------------------------------- | ------------------------------------------ |
| Touch targets (priority controls) | Improved (48×48 on searched surfaces)      |
| Reduce motion                     | PIN dots, verify quiz, shell transitions   |
| Contrast (muted text dark)        | Helper added; full sweep incomplete        |
| Screen reader labels              | Partial (tips, passcode semantics present) |
| Keyboard (web)                    | Partial — not fully audited                |
| Dynamic type                      | Not fully verified                         |
| WCAG 2.2 AA claim                 | **Not claimed** for Alpha                  |

---

## UX review

### Journeys reviewed (code + microcopy)

Create → backup (hidden by default) → verify (reduce-motion aware) → PIN → dashboard  
Import (SoftBanner guidance) → PIN  
Send / receive / activity receipts (Transaction ID wording)  
Security Center (fail-closed, biometric busy)  
Networks / Diagnostics (less jargon)  
Web Send / Privacy / Help (honest Alpha language)

### Remaining friction

- Preview vs live still requires tester education
- Some Advanced / Activity surfaces feel less polished than Home
- No production support inbox yet (intentional for Alpha)

---

## Engineering review

| Topic           | Assessment                                                                          |
| --------------- | ----------------------------------------------------------------------------------- |
| Architecture    | Engine + controllers remain coherent; session unlock is clearer                     |
| Duplication     | Acceptable for Alpha; muted color literals still scattered                          |
| Maintainability | PIN v2 dual-path documented for migration                                           |
| Dependencies    | Not freshly audited in this pass                                                    |
| Tests           | Web `tsc --noEmit` passed; `flutter test` **All tests passed** via `.tools/flutter` |

Suggested local verification:

```bash
cd apps/mobile && flutter test
cd apps/web && npx tsc --noEmit
```

---

## Critical blockers (Closed Beta)

1. **Live signing & broadcast** with audited key path
2. **Production-grade PIN/KDF + lockout**
3. **Web secret storage threat model** fixed or web signing permanently disallowed
4. **Physical device + a11y matrix** signed off
5. **Support / incident channel** (even private) for beta cohort

## High-priority improvements (next)

1. Sweep `AetherColors.muted` → `mutedFor(context)` in dark-critical screens
2. Global IconButton 48×48 lint / theme default
3. Argon2id PIN migration with rehash-on-login
4. Automated a11y (web axe) + TalkBack smoke scripts
5. npm / pub dependency audit in CI

## Recommended next actions

1. Tag Internal Alpha build (`rm1-internal-alpha`) after local `flutter test` green
2. Circulate this report + known-limitations brief to testers
3. Open Closed Beta checklist tracking K-01…K-05
4. Schedule 1-day security + a11y hardening sprint before any external beta

---

## Approval

| Gate               | Decision                                                                  |
| ------------------ | ------------------------------------------------------------------------- |
| **Internal Alpha** | **CONDITIONAL APPROVAL** (see ELT review + tester brief)                  |
| **Closed Beta**    | **REJECTED** — execute P0 blockers in `docs/ELT_INTERNAL_ALPHA_REVIEW.md` |

**Score rationale (78/100 after ELT cycle):** Board found and fixed ship-blocking trust/security defects (`changePin`, biometrics stage eject, send overclaim, empty QR, synthetic security theater). Cap remains until live derivation/broadcast, Argon2id, and device/a11y proof.
