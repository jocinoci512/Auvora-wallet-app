# Play Console financial features draft — Auvora Wallet

Classification: **Non-custodial cryptocurrency wallet**

This is a product description for Play Console questionnaires. It is not legal advice and makes no regulatory claim.

## What users control

- Users control their wallet keys on the device they use.
- Auvora does not custody user funds.
- Recovery phrase, mnemonic, and private keys remain local.
- Server-side signing is disabled.

## What this release does **not** do

- Live on-chain broadcast is disabled (`liveBroadcastEnabled = false`). Prepared transfers stay on-device as previews.
- Fiat on-ramp checkout is not live. Partner buy widgets are not enabled for this release.
- Receive funding (QR / copy / share of deposit addresses) is locked in this release. Users should not send real funds to it.
- NFT marketplace or NFT wallet features are not included.

## WalletConnect

- When configured, the app can pair with dApps through Reown / WalletConnect.
- Approvals are explicit. Live broadcast remains off, so WalletConnect cannot bypass the broadcast kill switch to send chain transactions.
