# Background Workers

**Phase:** 18  
**Service:** `@auvora/wallet-service` → `WalletWorkersService`

## Workers

| Worker             | Interval env                                 | Responsibility                          |
| ------------------ | -------------------------------------------- | --------------------------------------- |
| Sync Worker        | `WALLET_SYNC_INTERVAL_MS` (default 30s)      | Batch balance/network sync              |
| Balance Worker     | `WALLET_BALANCE_INTERVAL_MS` (default 45s)   | Balance refresh batch                   |
| Transaction Worker | sync + 5s                                    | Trigger chain sync; duplicate detection |
| Portfolio Worker   | `WALLET_PORTFOLIO_INTERVAL_MS` (default 60s) | Aggregate portfolios for active owners  |
| Retry Worker       | `WALLET_RETRY_INTERVAL_MS` (default 20s)     | Drain `WalletRetryQueue`                |
| Health Worker      | `WALLET_HEALTH_INTERVAL_MS` (default 60s)    | Probe Phase 18 network status           |

Kill switch: `WALLET_WORKERS_ENABLED=false` (also disabled when `NODE_ENV=test`).

## Health endpoint

`GET /api/v1/wallet-engine/workers/health` — last run, duration, error, run count per worker.

## Error recovery

- RPC / timeout failures increment `metadata.chainSync.retryCount` and enqueue retry jobs
- Duplicate transaction sync keys are skipped (in-memory set)
- Partial sync: per-wallet isolation; one failure does not abort the batch
- Rate limiting: client timeouts via `BLOCKCHAIN_HTTP_TIMEOUT_MS`

## Observability

Spans: `wallet.worker.sync|balance|transaction|portfolio|retry|health`
