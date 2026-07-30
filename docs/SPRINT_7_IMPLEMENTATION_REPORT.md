# Sprint 7 Implementation Report

## Summary

Sprint 7 delivered a preview-first Web3 Connections & Permission Center with mobile-first UX and web parity. Sessions, grants, pairing, signature/transaction requests, and activity use a WalletConnect-shaped local model without installing a live WalletConnect/Reown SDK. Copy stays honest: preview pairing is not a live relay session, and simulation is not live chain state.

## What shipped

### Mobile connections domain (`apps/mobile/lib/connections/`)

- Models: connection methods, permission codes (aligned to `VIEW_*` / `REQUEST_*` wire codes), trust indicators, connection requests, sessions, grants, signature/tx requests, and Web3 activity events.
- Plain-language permission catalog with risk and “can move funds?” flags.
- Known-origin catalog + lookalike heuristics for calm risk warnings.
- `ConnectionsController` with SharedPreferences preview persistence for sessions, pending requests, signatures, transactions, and activity.
- Simulated pairing for `wc:` URIs, QR/deep-link origins, and desktop/mobile pairing codes.

### Mobile UI (`apps/mobile/lib/ui/connections/`)

- Connection approval bottom sheet (trust chips, permissions, auth-gated Approve/Reject).
- Connect dApp screen (QR, paste URI, pairing code, sample Uniswap pairing).
- Permission Center with search/sort/filter, rename, disconnect/reconnect, per-grant revoke, and demo sign/tx enqueue.
- Signature and dApp transaction request sheets with humanized payloads and preview simulation notes.
- Web3 activity screen with kind/query filters.
- Shared biometric/PIN gate for all approve paths.

### Entry points and Security Center

- More tab: Web3 & permissions, Connect dApp, Web3 activity.
- Home “More actions”: Connect shortcut.
- Security Center: connected-apps summary card deep-linking to Permission Center (no duplicate thin inventory).
- `SecurityController` syncs connected-apps score/checkup input from `ConnectionsController`.

### Web parity (`apps/web/src/lib/web3/*`, `components/web3/*`)

- Shared permission catalog, session helpers, and trust assessment mirroring mobile vocabulary.
- Hub connection-approval panel with WalletConnect-shaped desktop pairing preview (QR/URI/pair code).
- Permission Center, Signing, Activity, and Hub experiences use plain-language grants, trust chips, and preview banners that never claim “verified safe” without catalog verification flags.
- Settings Connected dApps composes the same grant/session model as `/web3/permissions` instead of a forked demo list.
- Security Center continues to point at `/web3/permissions`.

## Security architecture notes

- `ConnectionsController` owns protocol/session state; `SecurityController` remains the security _summary_ (score, checkup, risky-dApp factor).
- Every mobile Approve path for connect/sign/tx goes through `authenticateConnectionsAction` when a PIN/biometrics gate applies.
- Trust chips are only affirmative when data exists (verified domain, HTTPS, previously connected, known catalog). Otherwise: “We can’t verify this site yet.”
- Preview persistence is local-first and labeled as such so UX never implies live WalletConnect relay encryption.

## Future real-WC extensibility

Swap the preview session store for a Reown/WalletConnect SDK without redesigning UX:

1. Keep approval sheets, Permission Center, and activity screens as presentation.
2. Replace `createPairingRequest` / `approveConnection` / session persistence with SDK pair + session APIs.
3. Map SDK session namespaces onto the same `DappPermissionCode` catalog and grant rows.
4. Keep auth gates in the UI layer; do not move approval auth into the relay client.

## Verification

- `dart analyze` on connections domain, UI, Security Center wiring, and `main.dart` — clean.
- `flutter test test/connections_controller_test.dart` — permission mapping, approve/reject, revoke, activity filter, risk heuristics, sign/tx activity.
- Web `npx tsc -p tsconfig.json --noEmit` on updated `/web3` and settings experiences.

## Accessibility and UX

- Mobile: bottom sheets, large touch targets, screen-reader-oriented Approve/Reject labels.
- Web: keyboard-friendly actions, calm risk alerts, reduced reliance on fear copy.
- Explicit preview banners wherever sessions or simulation are not live.

## Known limitations

- No real WalletConnect/Reown relay or session encryption.
- No injected EIP-1193 provider for an iframe browser.
- Transaction simulation remains illustrative placeholder text.
- NFT marketplace/viewer remains permanently out of scope.

## Council review follow-up (post Sprint 7 hardening)

Cross-functional review (Security Council, Blockchain, Product, UX) identified preview-honesty and approval-safety gaps. Hardening applied before Sprint 7 approval:

- Fail-closed PIN/biometric gate for all Web3 approve paths
- Synthetic WC origins no longer receive HTTPS trust chips; metadata-aware pairing when a proposer URL is present
- Typed-data / Permit signatures mark spending risk honestly
- Catalog chips say “In Auvora catalog (not attestation)” — never “Verified domain”
- Lookalike map covers `unlswap.org` and related typos on mobile + web
- Reconnect requires fresh approval; sessions upsert by origin
- Security Center no longer auto-marks dApps reviewed on open
- Web pairing preview banner keyed to `DEMO_PAIRING.preview`, not generic API live
- Hub Connect routes to connection approval (not signing); settings disconnect revokes when live
- Browser iframe copy: no injected provider; sandbox tightened

Remaining honesty note: this sprint is still **preview-first** (no live Reown relay). Production readiness for _UX transparency and accidental-approval protection_ is met; live WC cryptography remains a follow-up integration.
