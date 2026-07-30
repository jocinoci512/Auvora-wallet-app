# Sprint 3 — Send · Receive · QR

## Features completed

**Flutter (primary)**

- Guided **Send** flow: asset → recipient → amount → checklist review → biometric/PIN auth → receipt
- **Receive** with large QR (`qr_flutter`), network/asset switch, copy + share, wrong-network warnings
- **QR scanner** (`mobile_scanner`): torch, camera permission, URI parsing, haptic on success, network validation
- **Address book**: add/edit/delete, favorites, initials, persisted locally
- **Recent recipients** remembered after sends
- Outgoing txs appear in Activity as **Pending → Completed**; pull-to-refresh still works on Home
- Error prevention: invalid/wrong-network addresses, insufficient balance, self-send warn, double-tap guard, plain-language copy

**Web companion**

- Send review checklist (recipient / network / amount) before submit
- Receipt microcopy aligned with calm, honest confirmation language
- Existing Receive QR + Address book routes remain the desktop surfaces

## Architecture

- `lib/transfer/address_validation.dart` — network detection + plain-language validation + fee estimates
- `lib/transfer/address_book.dart` — contacts + recent store (`SharedPreferences`)
- `SendFlowScreen` / `ReceiveFlowScreen` / `QrScannerScreen` / `AddressBookScreen`
- `PortfolioController.recordOutgoingSend` — local secured pending tx + balance debit (no key exposure)
- `WalletController.authenticateForTransfer` — biometric gate before send

## Security

- Private keys never leave secure storage; never logged
- Send requires biometric **or** 6-digit PIN (no bypass)
- Checklist forces explicit verification before auth
- Receive warns when network selection is incompatible with current fingerprint address

## Performance

- QR detection debounced via single-handle flag
- Fee estimate is O(1) local math
- Address book JSON decode once on load
- Send step UI uses light progress dots (respects reduced motion via short animations)

## Honesty

On-device send records a **secured pending transfer** and updates Activity. Live chain broadcast / per-network derivation remain Sprint 4. UI states this clearly on the receipt.

## Sprint 4 remaining

1. Per-network address derivation (EVM / BTC / SOL)
2. Real RPC broadcast + fee oracles
3. Hardware camera UX polish on all OEM Android devices
4. Desktop WebRTC/camera QR (or USB scanner) beyond paste dialog
5. Swap / Buy / Bridge / Stake rails
