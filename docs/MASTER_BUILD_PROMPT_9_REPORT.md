# Master Build Prompt 9 of 10 — Release Candidate (RC1)

**Date:** 2026-07-31  
**Version:** `1.1.0-rc.1` · Channel `closed-beta` · Label `RC1 · Closed Beta`  
**Status:** Release Candidate for **trusted Closed Beta / simulated rails**  
**Recommendation:** **APPROVE** for Version 1.0 **Alpha** (closed cohort) · **REJECT** for Public Beta / live funding

---

## 1. Product readiness score

| Dimension                                  | Score (0–10) | Notes                                                              |
| ------------------------------------------ | ------------ | ------------------------------------------------------------------ |
| Feature completeness (planned Closed Beta) | 9.0          | Journeys present; rails are preview-honest                         |
| UX polish                                  | 8.5          | RC1 locked Receive QR; SoftBanner a11y; chip targets               |
| Security (Closed Beta posture)             | 8.5          | Kill switches off; fail-closed auth; residual Argon2id / iOS guard |
| Accessibility                              | 7.0          | Theme/a11y prefs wired; VoiceOver matrix unsigned                  |
| Performance / reliability                  | 8.0          | Prompt 8 stack retained; no OS background sync                     |
| Device / lab validation                    | 5.5          | Emulator/host only; physical matrix open (KI-H01)                  |
| **Overall Closed Beta RC1**                | **8.2 / 10** | Ship to trusted testers with **no real funds** brief               |
| Overall live-money readiness               | **3.5 / 10** | Blocked by KI-C01/C02/C03 + adapters                               |

---

## 2. QA summary

### Automated

- Flutter: **93** tests passed
- Flutter analyze: no errors (1 pre-existing info on WC sheet context)
- Web: typecheck PASS · eslint PASS · Jest 7 PASS · production build PASS

### Journeys (code + honesty review)

| Journey                                               | Result                                                    |
| ----------------------------------------------------- | --------------------------------------------------------- |
| Install → create → backup → verify → PIN → biometrics | Pass (preview)                                            |
| Receive                                               | Pass — **funding locked** (QR/copy/share disabled in RC1) |
| Send                                                  | Pass — preview broadcast; offline blocked; auth required  |
| Swap / Bridge / Stake / Buy                           | Pass — preview honesty banners                            |
| Web3 connect / disconnect                             | Pass — preview WC; fail-closed approve                    |
| Lock / restore / settings                             | Pass                                                      |
| Offline / reconnect                                   | Pass (soft banners + cache)                               |

### Failure modes reviewed

Offline send, RPC partial failure, corrupt cache drop, WC invalid deep link, auth cancel — graceful or fail-closed.

---

## 3. Security summary

**Zero Critical bugs that allow live fund loss in intended Closed Beta use** (funding + broadcast kill switches + RC1 Receive lock).

| Item                    | Status                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `liveBroadcastEnabled`  | **false** (tested)                                                                          |
| `allowFundingAddresses` | **false**; QR/copy/share disabled                                                           |
| Secure key storage      | OS secure storage                                                                           |
| Send / WC auth          | Fail-closed without PIN                                                                     |
| Diagnostics export      | No keys/seeds/PINs                                                                          |
| Crash reporting         | Toggle disabled — no SDK                                                                    |
| Open High residuals     | Argon2id (KI-C03), iOS screenshot (KI-H05), web JWT (KI-H03 mitigated), device lab (KI-H01) |

Full detail: [`docs/RC1_SECURITY_AUDIT.md`](RC1_SECURITY_AUDIT.md)

---

## 4. Accessibility summary

- Reduce motion, text scale, high contrast, large touch — theme-wired
- SoftBanner: Semantics + liveRegion
- Chip padding increased; ChoiceChips padded
- Screen-reader matrix (TalkBack/VoiceOver) **not** lab-signed — KI-H02
- WCAG 2.2 AA: oriented, **not certified**

Full detail: [`docs/RC1_ACCESSIBILITY_AUDIT.md`](RC1_ACCESSIBILITY_AUDIT.md)

---

## 5. Performance summary

- Android RC APK **75.2MB** (release)
- Cache-first portfolio; sync coalesce; price/help namespaces
- Cold-start + sync duration in Diagnostics
- OS background sync not claimed
- Physical battery / FPS lab open

Full detail: [`docs/RC1_PERFORMANCE_AUDIT.md`](RC1_PERFORMANCE_AUDIT.md)

---

## 6. Remaining medium/low-priority issues

See [`docs/RM2_KNOWN_ISSUES_REGISTER.md`](RM2_KNOWN_ISSUES_REGISTER.md).

Notable: KI-M01 l10n · KI-M02 muted sweep · KI-M04 offline lab · KI-M05 debug signing · KI-M06 background sync · KI-L01 web drift · KI-L03 auto-lock harshness.

---

## 7. Android RC build status

**PASS** — `flutter build apk --release`  
`apps/mobile/build/app/outputs/flutter-apk/app-release.apk` (**75.2MB**)  
Note: debug-signed (KI-M05) — fine for Closed Beta sideload; not Play Store–ready.

---

## 8. iOS RC build status

**BLOCKED** on Windows host — `flutter build ios` unavailable. Archive on macOS CI. Same exception as Prompts 1–8.

---

## 9. Web RC build status

**PASS** — Next.js production build · typecheck · lint · tests.

---

## 10. Recommendation

### APPROVE for Version 1.0 Alpha Release

**Meaning:** Closed Alpha / Closed Beta cohort on simulated rails with explicit **do not fund** brief.

### REJECT for Public Beta / live assets

Until: off-device HD verify + funding unlock policy, live adapters + `liveBroadcastEnabled` audit, Argon2id, device+a11y lab, release signing.

---

## RC1 fixes landed this prompt

1. Receive: disable QR / copy / share when funding locked; redacted derivation preview only
2. Asset detail: copy locked when funding locked
3. SoftBanner Semantics liveRegion
4. Chip theme padding + ChoiceChip tap targets
5. Crash reporting toggle disabled (honest) on mobile + web
6. Safer send error snackbars (no secrets)
7. Version bump `1.1.0-rc.1` / pubspec `1.1.0+4`
8. Issue register refreshed (KI-C01 corrected for BIP32)

---

## Self-review verdict

| Role             | Verdict                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| CPO              | Proud enough for **trusted** 10k? Prefer **smaller** closed alpha first — yes with brief |
| Principal Mobile | Architecture coherent; kill switches hold                                                |
| CISO             | Accept for simulated use; **not** for significant real assets                            |
| Lead UX          | Confidence improved by locked Receive                                                    |
| A11y Lead        | Progress; lab still owed                                                                 |
| QA Director      | Automation green; physical matrix owed                                                   |

**Ship RC1 as Closed Alpha candidate. Do not claim live wallet.**
