# Changelog — Version 1.0 Alpha (`1.0.0-alpha.1`)

All notable packaging and hardening changes for the Version 1.0 Alpha milestone (Master Build Prompt 10).

## [1.0.0-alpha.1] — 2026-07-31

### Added

- Android notification channels (`auvora_transactions`, `auvora_security`, `auvora_general`) created at app start
- Android adaptive launcher icons, splash colors, HTTPS-only `network_security_config`
- Optional release signing via `apps/mobile/android/key.properties` (example only in repo)
- ProGuard rules stub staged (minify **off** for Alpha)
- iOS export-compliance flag + `LSApplicationQueriesSchemes` for https / mailto
- Web About / Receive / Privacy aligned to Alpha kill switches and legal URLs
- Alpha docs: release notes, launch checklist, store readiness, testing guide, this changelog

### Changed

- Marketing version → `1.0.0-alpha.1` (mobile `+5`, web & monorepo aligned)
- About screens (mobile + web) wire Website / Privacy / Terms / Support from `ReleaseConfig`
- Crash reporting toggles disabled with honest “SDK unwired” copy
- Receive funding remains locked (QR / copy / share off)

### Security

- `liveBroadcastEnabled = false`
- `allowFundingAddresses = false`
- `allowBackup = false` on Android
- Cleartext HTTP denied on Android
- Diagnostics export excludes keys / seeds / PINs

### Known limitations

- iOS IPA / archive requires macOS + Apple Developer assets
- Play upload keystore still operator-provided (debug signing fallback for sideload)
- Hosted legal pages at `wallet.auvora.app` must be published before store review
- Minify / R8 deferred until keep-rules validated on device
