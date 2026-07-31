# Release Notes — Auvora Wallet Version 1.0 Alpha

**Version:** `1.0.0-alpha.1`  
**Channel:** `alpha`  
**Date:** 2026-07-31  
**Audience:** Trusted internal / closed Alpha testers

---

## Highlights

- First **Version 1.0 Alpha** packaging for real-world _simulated_ testing
- Android release APK (arm64, ~41 MB) and App Bundle (~68 MB) produced for internal distribution
- Store-oriented Android config (icons, splash, HTTPS-only network, deep links, notification channels, optional upload signing)
- iOS Info.plist hardened for deep links, Face ID / camera copy, export-compliance flag (archive on macOS)
- Web companion aligned to Alpha version and kill switches
- Honest About / Privacy messaging: funding locked; crash reporting unwired
- Flutter analyze clean · **93** mobile tests · web test/typecheck/lint/build green

## What you can test

- Wallet create / restore / lock / settings journeys (preview rails)
- Portfolio, search, offline cache / reconnect behavior
- Web3 connect / permission center / signing sheets (preview, fail-closed where required)
- Alpha feedback (mobile + web) — stays on-device until you copy it
- Diagnostics without seeds / keys / PINs

## Hard locks (do not work around)

- **Receive funding locked** — QR, copy, and share disabled; derivation preview only
- **Live broadcast off** — sends stay on-device previews
- **Crash reporting** — preference disabled; no crash SDK; nothing leaves the device

## Do not

- Send real funds to any address shown in Alpha
- Include recovery phrases, private keys, or PINs in feedback
- Treat this build as App Store / Play production-ready

## Known limitations

- Android release may be **debug-signed** until you add `android/key.properties` + upload keystore
- iOS builds require a **macOS** machine
- Hosted marketing / legal URLs (`wallet.auvora.app`) must be published before store review
- Physical device matrix and full a11y lab remain open (see RM2 known issues)

## Support

- Email: `alpha@auvora.app`
- In-app: Settings → About → Send Alpha feedback
- Web: Settings → Alpha feedback

## Related docs

- [`ALPHA_1.0_LAUNCH_CHECKLIST.md`](ALPHA_1.0_LAUNCH_CHECKLIST.md)
- [`MASTER_BUILD_PROMPT_10_REPORT.md`](MASTER_BUILD_PROMPT_10_REPORT.md)
- [`RELEASE_CANDIDATE_RC1.md`](RELEASE_CANDIDATE_RC1.md) (prior RC1 gate)
