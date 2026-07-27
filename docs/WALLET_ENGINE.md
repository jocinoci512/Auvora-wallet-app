# Wallet Engine

**Phase:** 18 — Enterprise Wallet Infrastructure Integration  
**Service:** `@auvora/wallet-service`

## Role

The Wallet Engine orchestrates **ledger wallets** with **on-chain operations** via the blockchain service HTTP API.

```
Web / Admin / SDK
        │
        ▼
Wallet Service  ──HTTP (INTERNAL_API_KEY)──►  Blockchain Service  ──►  Alchemy providers
   WalletEngine                                 BlockchainProvider port
   PortfolioEngine
   Workers
```

Wallet Core never calls Alchemy. Private keys never enter wallet responses or exports.

## Operations

| Operation | API | Notes |
|-----------|-----|-------|
| Create | `POST /api/v1/wallet-engine/wallets` | Ledger wallet + HD prefs + optional address provision |
| Restore | `POST /api/v1/wallet-engine/wallets/:id/restore` | Status restore + recovery verification stamp |
| Import | `POST /api/v1/wallet-engine/wallets/import` | **Public address only** |
| Export | `GET /api/v1/wallet-engine/wallets/:id/export` | Public metadata; `containsPrivateKeys: false` |
| Address generate | `POST .../addresses/generate` | Via blockchain internal API |
| Address validate | `POST /api/v1/wallet-engine/addresses/validate` | Blockchain or local format |
| Network switch | `POST .../network` | Preference `activeNetwork` |
| Account switch | `POST .../accounts/switch` | Preference `activeAccountIndex` |
| Account discover | `POST .../accounts/discover` | HD path templates (no keys) |
| Sync | `POST .../sync` | Balance + network tip + blockchain sync trigger |
| Recovery verify | `POST .../recovery/verify` | Metadata attestation only |

Existing `/api/v1/wallets/*` lifecycle (rename, archive, balances, ledger) remains unchanged.

## Account model

Stored in `Wallet.preferences`:

- `activeNetwork`, `activeAccountIndex`
- `accounts[]` with `index`, `label`, `derivationPath`, `address?`, `isDefault`
- Derivation paths are **metadata templates**; materialization of keys belongs in custody

## Security

- Export strips sensitive fields; policy `public_metadata_only`
- Import rejects invalid addresses; never accepts mnemonics/private keys
- Secrets never logged (blockchain client logs messages only)
- Address material from blockchain service does not include private keys

## Observability

OpenTelemetry spans: `wallet.engine.create`, `wallet.sync`, `wallet.portfolio.refresh`, `wallet.worker.*`
