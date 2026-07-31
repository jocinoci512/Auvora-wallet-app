# App Store & Desktop Release — Auvora Wallet

**Task:** 036  
**Status:** Documentation readiness for store / installer tracks (web-first RC1)

---

## Current Alpha track

**Version 1.0 Alpha** (`1.0.0-alpha.1`) is for closed testing only — not App Store / Play production.
See [`ALPHA_1.0_LAUNCH_CHECKLIST.md`](ALPHA_1.0_LAUNCH_CHECKLIST.md) and [`MASTER_BUILD_PROMPT_10_REPORT.md`](MASTER_BUILD_PROMPT_10_REPORT.md).

## Versioning strategy

| Channel            | Scheme                                 | Example                   |
| ------------------ | -------------------------------------- | ------------------------- |
| Monorepo / API     | SemVer                                 | `1.0.0-alpha.1` → `1.0.0` |
| Web / admin / docs | Same as monorepo tag                   | `v1.0.0-alpha.1`          |
| Mobile (Flutter)   | Store build number + marketing version | `1.0.0-alpha.1+5`         |
| Desktop installers | SemVer + channel                       | `1.0.0`, `1.0.0-beta.2`   |

Tag releases with `v*` to trigger `.github/workflows/release.yml`.

## Apple App Store (preparation)

- [ ] Apple Developer account + App ID
- [ ] Privacy Nutrition Labels aligned with actual data collection
- [ ] Sign in with Apple if required by guideline for alternate logins
- [ ] Export compliance / encryption questionnaire
- [ ] TestFlight build from Flutter iOS archive on macOS (`apps/mobile`)
- [ ] Review notes referencing `https://wallet.auvora.app` / `alpha@auvora.app`
- [ ] Privacy Policy URL + Terms URL (see below — Alpha hosts configured in `ReleaseConfig`)

## Google Play (preparation)

- [ ] Play Console app listing
- [ ] Data safety form
- [ ] Content rating questionnaire
- [ ] Target API level compliance
- [ ] Internal testing track → closed → production
- [ ] Same Privacy / Terms URLs

## Desktop installers (preparation)

- [ ] Code signing certificates (Windows Authenticode, macOS Developer ID)
- [ ] Auto-update channel policy
- [ ] Notarization (macOS)
- [ ] Installer smoke on Win10/11 + latest macOS

> Current product surface is **web-first**. Native shells should wrap `https://app.example.com` or ship the Next standalone build without changing API contracts.

## Release notes

Maintain user-facing notes in [`RELEASE_NOTES.md`](./RELEASE_NOTES.md) and GitHub Releases. Include:

- Security fixes
- Chain / network support changes
- Breaking API changes (none allowed without major bump)

## Legal references (configure in store listings)

| Document         | Production URL (set when published)                            |
| ---------------- | -------------------------------------------------------------- |
| Privacy Policy   | `https://wallet.auvora.app/legal/privacy` (host before submit) |
| Terms of Service | `https://wallet.auvora.app/legal/terms`                        |
| Support          | `alpha@auvora.app` (upgrade mailbox for GA)                    |
| Website          | `https://wallet.auvora.app`                                    |
| Support          | `https://docs.example.com` / support email                     |
| Status           | `https://status.example.com`                                   |

Do not ship store listings until legal pages are live and reviewed by counsel.

## Checklist before store submit

- [ ] Production API stable + status page green
- [ ] Privacy / Terms published
- [ ] Screenshots match production UI
- [ ] No simulator / debug flags in production builds
- [ ] Crash / analytics SDKs disclosed if added later
