# Sprint 6 Implementation Report

## Summary

Sprint 6 delivered a preview-first Security Center across mobile and web. The work introduces a dedicated security domain for score/checkup state, recovery phrase verification, preview device/session/dApp inventory, privacy controls, alerts, and emergency lock behavior without overstating protections that are still simulated.

## What shipped

- Added a dedicated mobile security domain in `apps/mobile/lib/security/` with:
  - `SecurityPreferences`, score/status helpers, checkup steps, trusted devices, active sessions, connected dApps, and alert models.
  - `SecurityController` backed by `SharedPreferences` for local-first preview persistence.
- Added a mobile `SecurityCenterScreen` reachable from `MoreTab` with:
  - dashboard score and status
  - interactive security checkup
  - recovery phrase management
  - biometric and PIN controls
  - trusted device and active session review
  - connected dApp review
  - privacy controls
  - alert timeline
  - emergency lock action
- Hardened recovery-state persistence:
  - onboarding backup confirmation is now tracked through `WalletController`
  - `WalletVaultRecord` now persists `phraseVerifiedAt` and `lastSecurityReviewAt`
  - `WalletEngine` can update security metadata without recreating the wallet
- Expanded web security preferences to cover:
  - auth requirements for send/settings/recovery actions
  - privacy visibility controls
  - clipboard timeout
  - security review timestamps
  - emergency notification muting
- Upgraded the web `SecurityCenterExperience` to surface:
  - score status and review timestamp
  - auth requirements summary
  - privacy and emergency sections
  - a preview emergency lock flow and alerts
- Extended the focused auth controls page and privacy center to use the same security preference contract.

## Security architecture notes

- `WalletController` remains the primary auth/session primitive on mobile.
- `WalletEngine` remains the only source for recovery phrase access and persisted wallet metadata.
- `SecurityController` composes higher-level protection state instead of overloading `WalletController`.
- Preview data for devices, sessions, dApps, and alerts is explicitly stored as local preview state, avoiding false claims about live infrastructure-backed inventories.
- Recovery phrase reveal stays behind session-gated engine access and additional re-auth prompts in the Security Center.

## Verification

- `flutter analyze` on the updated mobile security, wallet state, and wallet-engine surfaces passed.
- Added focused mobile tests in `apps/mobile/test/security_controller_test.dart` covering preview bootstrapping, persisted review preferences, and score status buckets.

## Accessibility and UX

- Large card-based sections and tappable controls were used for the mobile Security Center.
- Copy stays plain-language and action-oriented: what happened, why it matters, and what to do next.
- Emergency mode avoids fear-heavy language and explains the effect before action.

## Known limitations

- Device, session, connected dApp, and alert inventories are still preview/local-first for Sprint 6.
- Web biometrics remain preference messaging only, not production WebAuthn.
- Clipboard timeout is currently a stored preference and UX contract, not a platform-wide enforced clipboard manager.
- PIN strength guidance is limited to format validation and change-flow protection in this sprint.

## Recommended Sprint 7 follow-up

- Replace preview device/session/dApp stores with live backend sync and authoritative revocation APIs.
- Add real WebAuthn / passkey support on web.
- Add production security event ingestion and server-backed alert timelines.
- Add enforced clipboard clearing utilities where platform APIs support it.
- Introduce richer PIN strength feedback and recovery reset flows beyond device-local preview behavior.
