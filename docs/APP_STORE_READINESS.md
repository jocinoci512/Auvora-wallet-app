# Apple App Store / TestFlight — Readiness

**Updated:** 2026-08-03  
**App:** Auvora Wallet · Version `1.0.0-alpha.1`  
**Host note:** This workspace audit ran on **Windows** — iOS archive/TestFlight **cannot** be produced here.

---

## Status

| Gate                                   | Status                                            |
| -------------------------------------- | ------------------------------------------------- |
| Flutter iOS project present            | Assumed under `apps/mobile/ios` — verify on macOS |
| IPA / TestFlight build                 | **NOT DONE** on this host — **macOS required**    |
| Apple Developer account / certificates | Ops — not verified                                |
| Privacy Nutrition Labels               | Not filed                                         |
| App Store Connect listing              | Not started                                       |
| Live broadcast / funding               | Must stay OFF for Alpha (same kill switches)      |

**Verdict:** App Store / TestFlight readiness is **behind** Android Closed Testing. Treat iOS as a follow-on after Android closed beta stabilizes, unless a macOS builder is available now.

---

## macOS build checklist (when available)

1. Xcode + Flutter (`C:\Users\kwasi\flutter\bin` is Windows-only; use matching Flutter on Mac).
2. Open `apps/mobile/ios` · set Team / Bundle ID · push notifications capability only if used.
3. Confirm `Info.plist` usage strings (Face ID / camera for QR if enabled).
4. Archive Release; upload to TestFlight.
5. Same kill switches as Android — never enable broadcast for Alpha.
6. **DEVICE VERIFICATION REQUIRED** on physical iPhone: secure enclave storage, Face ID + auto-lock, WC deep links, funding lock.

---

## Policy / product honesty (App Review)

- State clearly: Alpha companion; simulated portfolio; no live send; receive funding locked.
- Do not claim NFT, staking live, or unrestricted DeFi.
- Recovery phrase never leaves device; no seed collection.
- Account email optional for cloud auth features.

---

## Blockers unique to iOS

| Blocker                              | Notes                                                        |
| ------------------------------------ | ------------------------------------------------------------ |
| No macOS CI attestation here         | Need Mac builder or cloud macOS                              |
| Associated Domains / Universal Links | Must match canonical domain                                  |
| App Tracking Transparency            | Only if tracking SDKs added (currently unwired)              |
| Export compliance (encryption)       | Standard HTTPS + local crypto — complete Apple questionnaire |

---

## Related

- [`docs/PLAY_STORE_READINESS.md`](./PLAY_STORE_READINESS.md)
- [`docs/KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md)
