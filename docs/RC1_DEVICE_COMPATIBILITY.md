# RC1 Device Compatibility Report

**Build:** `1.1.0-rc.1` · 2026-07-31  
**Verdict:** **PARTIAL** — layouts ready; physical matrix unsigned (KI-H01)

---

## Validated on this cycle

| Surface                                | Result                    |
| -------------------------------------- | ------------------------- |
| Windows host Flutter tests             | Pass                      |
| Android release APK assemble           | Pass (75.2MB)             |
| Web desktop companion production build | Pass                      |
| Light / Dark themes (code)             | Supported via Preferences |
| Wide layout breakpoints (Receive ≥900) | Present                   |
| Portrait-first mobile shell            | Present                   |

---

## Not validated physically this cycle

| Target                | Status                                        |
| --------------------- | --------------------------------------------- |
| Small Android phones  | Open                                          |
| Large Android phones  | Open                                          |
| Foldables             | Layout readiness only (breakpoints exist)     |
| Small / large iPhones | Open — iOS archive blocked on Windows         |
| Tablets               | Partial (wide constraints in flows)           |
| Landscape             | Partial (SafeArea + ListView; not lab-signed) |
| TalkBack / VoiceOver  | Open                                          |

---

## Signing / distribution

- Android APK is **debug-signed** (KI-M05) — Closed Beta sideload only.
- iOS IPA requires macOS CI.
- Web: standard Next production artifact.

---

## Recommendation

Distribute Android APK + web companion to closed cohort. Defer iOS TestFlight until macOS build. Run device matrix checklist before Public Beta.
