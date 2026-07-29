# Sync Architecture

**Phase:** 18

## Layers

```
┌─────────────────────────────┐
│ Wallet Workers / Engine API │  incremental per-wallet sync
└──────────────┬──────────────┘
               │ internal HTTP
               ▼
┌─────────────────────────────┐
│ Blockchain Service          │  tip height, balances, sync jobs
│  Alchemy / Simulator providers│
└─────────────────────────────┘
```

## Wallet-side sync (`WalletSyncService`)

1. Read `metadata.chainSync.address`
2. Fetch chain balance + network status from blockchain internal API
3. Write `lastBalance`, `lastBlockHeight`, `lastSyncedAt` into wallet metadata
4. Create ledger snapshot (`chain_sync_refresh`) for historical continuity
5. Trigger blockchain `SyncService.triggerManualSync(chain)` for block/tx indexing
6. On failure → update `lastError` / `retryCount` → enqueue retry

## Blockchain-side sync (`SyncService`)

- Existing block scan / address watch / retry jobs
- Simulator interval gated by `BLOCKCHAIN_SIMULATOR_ENABLED`
- Manual / internal trigger works for live Alchemy providers as well

## Conflict detection

`detectConflict(previous, next)` flags extreme balance jumps for operator inspection (soft signal; does not mutate ledger).

## Incremental / failed recovery

| Concern        | Mechanism                                               |
| -------------- | ------------------------------------------------------- |
| Incremental    | Only active wallets; metadata tip height                |
| Failed sync    | Retry queue + retry worker                              |
| Network outage | Graceful null from HTTP client; local validate fallback |
| Duplicate txs  | In-memory key on chain+address+blockHeight              |

## Internal API (blockchain)

| Method | Path                                                   |
| ------ | ------------------------------------------------------ |
| POST   | `/api/v1/internal/blockchain/addresses`                |
| POST   | `/api/v1/internal/blockchain/addresses/validate`       |
| GET    | `/api/v1/internal/blockchain/balances/:chain/:address` |
| GET    | `/api/v1/internal/blockchain/networks/:chain/status`   |
| POST   | `/api/v1/internal/blockchain/sync`                     |
| GET    | `/api/v1/internal/blockchain/chains`                   |

Auth: `x-internal-api-key` (same `INTERNAL_API_KEY` as wallet).
