# Swap Engine

**Phase:** 20 — Enterprise Swap Aggregation & DEX Platform  
**Service:** `@auvora/swap-service` (port **3013**)

## Overview

The Swap Engine aggregates quotes and routes across multiple DEX providers, selects the best route, prepares unsigned transactions for user confirmation, monitors execution, and stores receipts.

Wallet / Web clients call the gateway (`/api/v1/swaps`). Business logic never depends on a single vendor.

## Capabilities

| Capability              | Endpoint / service                        |
| ----------------------- | ----------------------------------------- |
| Networks                | `GET /api/v1/swaps/networks`              |
| Assets                  | `GET /api/v1/swaps/assets?network=`       |
| Quote                   | `POST /api/v1/swaps/quote`                |
| Routes                  | `POST /api/v1/swaps/routes`               |
| Prepare (simulate)      | `POST /api/v1/swaps/prepare`              |
| Execute (after confirm) | `POST /api/v1/swaps/execute`              |
| Monitor                 | `GET /api/v1/swaps/executions/:id`        |
| History                 | `GET /api/v1/swaps/history`               |
| Receipt                 | `GET /api/v1/swaps/receipts/:executionId` |

## Calculations

- **Min received** = `amountOut * (1 - slippageBps/10000)`
- **Price impact (bps)** from mid-market vs quoted output
- **Best route** = highest `amountOut`, then lowest `priceImpactBps`

## Workers

Gated by `SWAP_WORKERS_ENABLED`:

- Quote refresh / provider health
- Route cache heartbeat
- Transaction monitor
- Receipt synchronizer
- Retry queue

## Integrations

Fire-and-forget publishers (when URLs configured): Notifications, Analytics, AI, Observability. Optional Market Data / Blockchain / Wallet URLs for future enrichment.
