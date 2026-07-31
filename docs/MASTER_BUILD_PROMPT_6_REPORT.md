# Master Build Prompt 6 of 10 — Web3 Connectivity & dApp Platform Report

**Date:** 2026-07-31  
**Channel:** Mobile `1.1.0-beta.2` Closed Beta  
**Scope:** WalletConnect-shaped provider port, connection approval, Permission Center, signing review, deep links, Web3 activity, trust indicators  
**Status:** Complete for software + Android APK + web companion on this host; iOS requires macOS  
**NFT policy:** Permanently out of scope — OpenSea / NFT category scrubbed from web demo catalog

---

## Audit summary

Sprint 7 already delivered a polished **preview-first** Web3 stack (`ConnectionsController`, Permission Center, approval/signing sheets, `/web3/*` web parity) wired to a local store / connections-service **simulator** — not a live Reown relay.

Prompt 6 **extended that foundation in place**:

- `WalletConnectProviderPort` + `PreviewWalletConnectProvider` for protocol upgrades without redesigning UX
- Session expiry / restore / disconnect-all
- OS deep-link registration + `app_links` listener
- Stronger trust / signature intelligence copy
- NFT marketplace residues removed from web demo

**Kill switches unchanged:** `liveBroadcastEnabled=false`, `allowFundingAddresses=false`.

---

## 1. Features completed

| Feature                   | Detail                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| WalletConnect integration | Provider port (v2-shaped); preview provider for QR / URI / deep-link pairing; architecture ready for live Reown swap |
| Connection approval       | App name, domain, logo hint, networks, permissions, risk/trust chips, connection time; auth-gated Approve/Reject     |
| Permission Center         | Connected apps, grants, networks, activity, rename, revoke, disconnect one / all, restore / reconnect                |
| Secure signing            | PIN/biometric gate; never auto-sign; wallet + network + risk shown                                                   |
| Signature review          | Plain-language ownership vs spending / Permit guidance (`SignatureIntelligence`)                                     |
| Deep links                | `auvora://wc                                                                                                         | sign | auth | tx`, `wc:`, HTTPS App Links placeholders; invalid links rejected calmly |
| Web3 activity             | Filters for connect / disconnect / sign / tx / expired / restored / deep link / security                             |
| Trust indicators          | Catalog (not attestation), HTTPS, previously connected, unknown app, newly seen domain + why warnings appear         |

---

## 2. Existing systems improved

| Area                    | Improvement                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ConnectionsController` | Provider injection, expiry on bootstrap, restore, disconnect-all, inbound deep-link handling, replay hash on signatures |
| Models                  | Session topic / protocol / expiry / restore timestamps; expanded activity kinds; trust unknown/newly-seen flags         |
| Mobile UI               | Permission Center disconnect-all + restore; richer signature/tx sheets; Connect accepts `initialUri`                    |
| Web `/web3`             | Signing plain-language alerts; Permission Center disconnect-all; trust notes explain _why_                              |
| Web demo catalog        | Removed NFT category + OpenSea card; Axie copy no longer promotes NFT trading                                           |

---

## 3. Security improvements

- Fail-closed auth retained on all approve paths
- Invalid / unsupported deep links never auto-approve
- Signature request hashes for replay protection
- Session expiration forces fresh reconnect approval
- Preview honesty banners retained (not a live relay)
- Sensitive pairing still local-first; no mnemonic logging

---

## 4. Web3 integrations verified

| Integration                        | Status                                                   |
| ---------------------------------- | -------------------------------------------------------- |
| QR pairing UI                      | Verified (mobile scanner → pairing → approval)           |
| `wc:` / `auvora://wc` parsing      | Verified in unit tests                                   |
| Session restore / expiry           | Verified in unit tests                                   |
| Permission revoke / disconnect all | Verified                                                 |
| Signing + typed-data spending risk | Verified                                                 |
| Connections-service simulator      | Unchanged; still available via web `/connections` lab    |
| Live Reown relay                   | **Not enabled** (Closed Beta) — port is the upgrade seam |

---

## 5. Performance improvements

- Session expiry / restore stay on-device (SharedPreferences)
- Deep-link listener is event-driven (`app_links`), not polled
- Activity filters remain local list scans
- No new background network monitoring

---

## 6. Testing completed

| Suite                                  | Result                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `connections_controller_test.dart`     | Pairing, approve/reject, revoke, expiry, restore, disconnect-all, deep links, invalid QR |
| Full `flutter test`                    | **82 passed**                                                                            |
| Flutter analyze (connections surfaces) | **No errors** (info-only lint noise cleared where practical)                             |
| Web `tsc` / ESLint (touched)           | **Passed**                                                                               |
| Web production build                   | **Passed**                                                                               |

---

## 7. Remaining work (Prompt 7+)

1. Live Reown / WalletConnect relay behind `WalletConnectProviderPort`
2. Android App Links domain association for `wallet.auvora.app`
3. iOS Associated Domains entitlement on macOS CI
4. Injected EIP-1193 provider for in-app browser (still preview iframe)
5. Live gas / simulation from chain adapters

---

## 8. Android build status

| Item                          | Result                                    |
| ----------------------------- | ----------------------------------------- |
| `flutter analyze`             | No errors on connections surfaces         |
| `flutter test`                | **82 passed**                             |
| `flutter build apk --release` | **Passed** — `app-release.apk` **74.9MB** |

---

## 9. iOS build status

| Item                | Result                                               |
| ------------------- | ---------------------------------------------------- |
| `flutter build ios` | **Blocked on Windows host** — requires macOS + Xcode |
| URL schemes         | `auvora` + `wc` registered in `Info.plist`           |
| Source readiness    | Same Flutter tree as Android                         |

---

## 10. Web build status

| Item             | Result     |
| ---------------- | ---------- |
| TypeScript       | **Passed** |
| Lint (touched)   | **Passed** |
| Production build | **Passed** |

---

## Deliverable checklist

- [x] WalletConnect Integration (provider port + preview; live relay deferred honestly)
- [x] Connection Approval Flow
- [x] Permission Center
- [x] Secure Transaction Signing
- [x] Signature Review
- [x] Deep Link Support
- [x] Web3 Activity History
- [x] Trust Indicators
- [x] Android Production Build
- [ ] iOS Production Build (host limitation)
- [x] Web Production Build
- [x] No TypeScript errors
- [x] No Lint errors (touched surfaces)
- [x] No Runtime errors in verified tests
- [x] No Broken Navigation
- [x] NFT galleries / trading remain permanently removed

**Ready for Master Build Prompt 7** after iOS is verified on macOS (optional gate) or when product accepts the Windows-host iOS exception as for Prompts 1–5.
