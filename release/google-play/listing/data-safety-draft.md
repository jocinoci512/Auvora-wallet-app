# Play Console Data safety draft — Auvora Wallet

Human-readable draft for the Play Console Data safety form. Confirm with counsel before submission. Do **not** declare “no data collected.”

## Data the app may process

### Account / identity (when the user creates or signs in to an Auvora account)

- Email address
- Username and optional name fields supplied by the user
- Authentication tokens and session identifiers
- Coarse device/session metadata used for native login (for example device fingerprint, platform label `android`, optional device name / app version)

Processed by the Auvora backend (public Gateway: `https://api.auvorawallet.com`) for account register, login, logout, refresh, and current-user/profile routes.

### Public wallet identifiers (when account or connection features require them)

- Public wallet addresses may be transmitted (for example WalletConnect session accounts, or account-linked device metadata)
- Auvora does **not** collect wallet signing secrets

### Blockchain network requests

- RPC providers receive standard blockchain read requests (balances, tips, health probes) for configured networks
- These requests may include public addresses
- Live transaction broadcast is currently disabled in this release

### Market data

- Market-data providers (for example CoinGecko / CoinCap; Alchemy Prices only if a client key is compiled in) receive symbol/price queries
- Queries are for market quotes, not seed phrases or private keys

### WalletConnect / Reown

- Reown handles WalletConnect pairing and session metadata (dApp name, origin, requested chains/methods, public accounts)
- The public Project ID may be compiled into the client
- The Reown Secret is never shipped in the Android app

## Data that stays on the device

- Private keys
- Recovery phrase / mnemonic / seed
- On-device vault material
- Wallet PIN / biometric unlock material (OS-backed storage)

Auvora does not collect wallet signing secrets. Server signing is disabled.

## Advertising, analytics, crash reporting

- No ads
- No currently wired analytics SDK (in-app Analytics toggle is unavailable)
- No currently wired crash SDK (Sentry is not linked unless a future build compiles `SENTRY_DSN` **and** `SENTRY_ENABLED=true` **and** wires the SDK)

## Security practices (factual)

- Data is encrypted in transit (HTTPS) for account API calls
- Wallet secrets are stored in platform secure storage, not uploaded for self-custody
- Users can use the wallet without creating an Auvora cloud account

## Approximate location / contacts / photos

- Not required for core wallet use
- Camera is used only when the user scans a WalletConnect QR
- Contacts permission is not part of the core wallet flow
