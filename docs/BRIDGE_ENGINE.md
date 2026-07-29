# Bridge Engine

**Phase:** 24 — Cross-Chain Bridge & Asset Transfer  
**Service:** `@auvora/bridge-service` (port **3017**)

## Overview

The Bridge Engine quotes, prepares, and executes cross-chain asset transfers behind `BridgeProviderPort`. Business logic never depends on a single vendor.

Gateway routes: `/api/v1/bridge` and `/api/v1/admin/bridge`.

## Capabilities

| Capability         | Endpoint                                 |
| ------------------ | ---------------------------------------- |
| Networks           | `GET /api/v1/bridge/networks`            |
| Routes             | `GET /api/v1/bridge/routes`              |
| Assets             | `GET /api/v1/bridge/assets?network=`     |
| Quote              | `POST /api/v1/bridge/quote`              |
| Prepare            | `POST /api/v1/bridge/prepare`            |
| Confirm (required) | `POST /api/v1/bridge/confirm`            |
| Sync status        | `POST /api/v1/bridge/transfers/:id/sync` |
| History            | `GET /api/v1/bridge/history`             |

## Security

- Explicit `confirmed: true` before execution
- Route / network / amount validation
- Replay nonce on quotes
- Receipt payloads encrypted at rest
- Secrets never logged

## Workers

Gated by `BRIDGE_WORKERS_ENABLED`: status sync, route catalog sync, fee refresh, retry queue, provider health.
