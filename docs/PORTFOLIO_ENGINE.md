# Portfolio Engine

**Phase:** 18  
**Service:** `@auvora/wallet-service` → `PortfolioEngineService`

## Capabilities

| Feature | Description |
|---------|-------------|
| Portfolio aggregation | All wallets for a user |
| Network aggregation | Totals grouped by `assetChain` |
| Token aggregation | Totals grouped by `assetCode` / standard |
| Wallet summaries | Ledger + last synced chain balance |
| Historical balances | Existing `BalanceSnapshot` via ledger (`chain_sync_refresh` snapshots) |
| Portfolio totals | `portfolioLedgerTotal`, `walletCount` |

## API

- `GET /api/v1/wallet-engine/portfolio`
- `GET /api/v1/wallet-engine/wallets/:walletId/summary`

## Data sources

| Field | Source |
|-------|--------|
| `ledgerBalance` / `availableBalance` | Internal ledger (`WalletBalance`) |
| `chainBalance` | `metadata.chainSync.lastBalance` from last successful sync |
| `lastSyncedAt` | `metadata.chainSync.lastSyncedAt` |

Chain balances do **not** auto-mutate the ledger (payments/ledger integrity preserved). Sync refreshes metadata and may create a ledger snapshot for history continuity.

## Token standards (Phase 18)

| Chain | Native | Token standard |
|-------|--------|----------------|
| Ethereum | ETH | ERC-20 |
| BNB Smart Chain | BNB | BEP-20 |
| Solana | SOL | SPL |
| Tron | TRX | TRC-20 |
| Bitcoin | BTC | Native only |
