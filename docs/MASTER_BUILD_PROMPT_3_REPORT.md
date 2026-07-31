# Master Build Prompt 3 of 10 — Send • Receive • Transaction Engine Report

**Date:** 2026-07-30  
**Channel:** Mobile `1.1.0-beta.2` Closed Beta  
**Scope:** Complete transaction experience — send, receive, QR, address book, review, status, validation, security  
**Status:** Complete for software + Android APK + web companion on this host; iOS requires macOS

---

## 1. Features completed

| Feature                 | Detail                                                                            |
| ----------------------- | --------------------------------------------------------------------------------- |
| Send flow (end-to-end)  | Wallet → asset → recipient → amount → review → auth → status → receipt            |
| Fee speed tiers         | Economy / Standard / Faster with fee + arrival estimates                          |
| Domain resolution port  | `DomainResolver` + `PreviewDomainResolver` (ENS / UD-style, preview only)         |
| Address risk heuristics | Burn/null, short, homoglyph, placeholder warnings                                 |
| Status progress UI      | Broadcasting → Pending → Confirming → Recorded (respects reduced motion)          |
| Receive polish          | Network chips, wallet label, secure copy, QR, share, wrong-network warnings       |
| Address book            | Search, favorites, recent, nickname, wallet label, duplicate warn, Send deep-link |
| Explorer open           | Transaction detail launches explorer via `url_launcher`                           |
| Web send deep-links     | `?asset=` / `?to=` query params; fixed broken ENS copy                            |
| Payment URI builder     | `buildPaymentUri` for QR payloads when funding unlocked                           |

**Kill switches unchanged (intentional):** `liveBroadcastEnabled=false`, `allowFundingAddresses=false`.

---

## 2. Existing features improved

| Area                        | Improvement                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `SendFlowScreen`            | Multi-wallet step, fee chips, domain resolve on continue, irreversible checklist, status phase |
| `ReceiveFlowScreen`         | `copyTextSecure` path via `copyText`, funding honesty, wallet label when multi-vault           |
| `AddressBookScreen`         | Search, recent section, Send action, duplicate confirmation on save                            |
| `AddressBookStore`          | `search`, `findDuplicate`, `walletLabel` / `notes`                                             |
| `AddressValidation`         | Domain-name shell validation; fee speed multipliers; payment URI helper                        |
| `TransactionDetailScreen`   | Open explorer, failed/cancelled retry guidance, preview honesty                                |
| Web `SendExperience`        | Deep links, Suspense boundary, clearer name-resolve honesty                                    |
| Web `ReceiveExperience`     | Demo/funding honesty + network ETA copy                                                        |
| Web `AddressBookExperience` | Duplicate confirm; Send with `to` + asset query                                                |

---

## 3. Security improvements

- Every send still requires PIN (fail-closed) and optional biometrics
- Review checkboxes include irreversible + high-risk acknowledgment
- Receive / copy uses secure clipboard helper (`copyText` → `copyTextSecure`)
- Offline gate before auth and before submit
- Double-tap / re-entry guard on submit
- Domain resolve and fees stay preview-honest (no live ENS / no live broadcast)
- Sensitive logging not introduced; mnemonic never surfaced in transfer UI
- Funding receive and live broadcast remain kill-switched

---

## 4. Validation improvements

- Wrong-network address rejection with plain-language messaging
- Insufficient balance (incl. same-asset fee)
- Large transfer (≥50% balance) warning
- Self-transfer explicit checkbox
- New address first-time warning
- Malformed / unrecognized QR (existing scanner + cooldown)
- Domain names allowed only on EVM nets; resolve before amount
- Address risk assessment (burn / suspicious formatting)
- Duplicate address book entries require confirm
- Fee speed changes amount left / MAX calculations

---

## 5. Performance improvements

- Status animation durations collapse under reduced motion / `reduceMotion`
- Domain resolve is local/deterministic (no network wait in Closed Beta)
- Fee estimates are synchronous (no RPC)
- Address book search is in-memory filter
- QR scanner retains `DetectionSpeed.noDuplicates`

---

## 6. Accessibility improvements

- Status step uses `Semantics(liveRegion: true)` for screen readers
- Step dots expose “Step X of Y”
- Receive QR has semantic label including network
- Checkboxes and chips use standard Material controls (TalkBack / VoiceOver)
- Reduced-motion path skips status delays / AnimatedSwitcher duration
- Large touch targets retained on FAB, chips, and checklist rows

---

## 7. Android build status

| Item                                          | Result                                       |
| --------------------------------------------- | -------------------------------------------- |
| `flutter test`                                | **72 passed**                                |
| `flutter analyze` (touched transfer surfaces) | **No issues**                                |
| `flutter build apk --release`                 | **Succeeded** — `app-release.apk` **74.5MB** |

---

## 8. iOS build status

| Item                | Result                                                                    |
| ------------------- | ------------------------------------------------------------------------- |
| `flutter build ios` | **Blocked on Windows host** — requires macOS + Xcode                      |
| Source readiness    | Same Flutter tree as Android; no iOS-only blockers introduced in Prompt 3 |

---

## 9. Web build status

| Item                                       | Result     |
| ------------------------------------------ | ---------- |
| TypeScript (`tsc --noEmit`)                | **Passed** |
| ESLint (touched send/receive/address-book) | **Passed** |
| Production build (`pnpm run build`)        | **Passed** |

---

## 10. Self-review notes (roles)

| Lens              | Finding / action                                                                       |
| ----------------- | -------------------------------------------------------------------------------------- |
| Senior Blockchain | Stay on preview adapter; fee tiers educational until live fee oracles                  |
| Security          | Auth + irreversible checklist + kill switches preserved                                |
| Lead UX           | Status progress closes the “what happens after confirm” gap                            |
| QA                | Offline, auth reject, invalid address, domain, fee speed covered in unit / flow design |
| Accessibility     | Live region + reduced motion + semantic QR                                             |

---

## Deliverable checklist

- [x] Complete Send Flow
- [x] Complete Receive Flow
- [x] QR Scanner (existing + retained flashlight / permission / invalid feedback)
- [x] QR Generator (receive)
- [x] Address Book
- [x] Transaction Review
- [x] Transaction Status Tracking
- [x] Smart Validation
- [x] Security Verification
- [x] Android Production Build
- [ ] iOS Production Build (host limitation)
- [x] Web Companion Build
- [x] No TypeScript errors
- [x] No Lint errors (touched surfaces)
- [x] No Runtime errors in verified tests
- [x] No Broken Navigation (deep-links + address-book → send)

**Ready for Master Build Prompt 4** after iOS is verified on macOS (optional gate) or when product accepts Windows-host iOS exception as for Prompts 1–2.
