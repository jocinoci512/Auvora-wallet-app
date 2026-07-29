# Wallet Flows

**Task:** 029 — Premium Wallet Experience  
**App:** `apps/web`  
**Figma:** [Auvora Design System](https://www.figma.com/design/<YOUR_FIGMA_FILE_KEY>) → page **Wallet Experience**

## Principles

- Code + `@auvora/ui` remain the source of truth; Figma stays in sync as a publish target.
- Existing ledger APIs (`/api/v1/wallets`, blockchain, connections, custody) are **not** replaced.
- Mnemonics are never persisted by the UI; recovery rehearsal keeps phrases in memory only.
- Preview flows degrade gracefully when the gateway is offline.

## Entry points

| Flow               | Route                 | Component                      |
| ------------------ | --------------------- | ------------------------------ |
| Onboarding hub     | `/wallets/onboarding` | `OnboardingExperience`         |
| Create             | `/wallets/create`     | `CreateWalletExperience`       |
| Import             | `/wallets/import`     | `ImportWalletExperience`       |
| Restore            | `/wallets/restore`    | `RestoreWalletExperience`      |
| Watch-only         | `/wallets/watch`      | `WatchOnlyExperience`          |
| Hardware           | `/wallets/hardware`   | `HardwareWalletExperience`     |
| Recovery rehearsal | `/wallets/recovery`   | `RecoveryPhraseExperience`     |
| Send               | `/send`               | `SendExperience`               |
| Receive            | `/receive`            | `ReceiveExperience`            |
| Address book       | `/address-book`       | `AddressBookExperience`        |
| Activity           | `/activity`           | `TransactionHistoryExperience` |
| Security           | `/security`           | `SecurityExperience`           |

Legacy `/wallets/new` redirects to `/wallets/create`.

## Create wallet steps

1. Name (+ optional alias)
2. Network / asset selection
3. Account preview
4. Backup acknowledgement checklist
5. Confirm → `createWallet` SDK call (preview success if API unavailable)
6. Success → wallet detail / recovery / receive

## Import & restore

- Import: intro warnings → phrase entry → challenge words → network → done (phrase cleared from state)
- Restore: education → enter/demo phrase → challenge → safety checklist → done
- Demo phrases use a BIP39 word subset for rehearsal only

## Watch-only & hardware

- Watch-only validates address formats per network, then hands off to Connections for READONLY adapters
- Hardware pairing simulates device wait, then deep-links to `/connections` for live sessions

## Send & receive

- Send: asset → address (book/recent/QR paste) → amount → fee tiers → preview → progress → receipt
- Receive: network/token → QR (`qrcode`) → copy/share + network warning

## Shared UI

- `WizardShell` progress + step list
- `wallet-experience.css` tokens/motion/responsive rules
- Design system: `Button`, `Card`, `Alert`, `Dialog`, `Checkbox`, `Switch`, `EmptyState`, `SuccessState`

## Verification URLs

- http://localhost:3000/wallets/onboarding
- http://localhost:3000/send
- http://localhost:3000/receive
- http://localhost:3000/activity
- http://localhost:3000/security
