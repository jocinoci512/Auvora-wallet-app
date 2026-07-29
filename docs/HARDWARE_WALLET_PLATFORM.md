# Hardware Wallet Platform

**Phase:** 23 — Hardware Wallet & External Wallet Connectivity  
**Service:** `@auvora/connections-service` (port **3016**)

## Overview

The Hardware Wallet Platform discovers, pairs, and manages external signing devices behind `ConnectionProviderPort`. Core wallet logic never depends on a single vendor (Ledger, Trezor, etc.).

Gateway routes: `/api/v1/connections` and `/api/v1/admin/connections`.

## Capabilities

| Capability       | Endpoint                                                |
| ---------------- | ------------------------------------------------------- |
| Discover devices | `GET /api/v1/connections/devices/discover`              |
| List paired      | `GET /api/v1/connections/devices`                       |
| Pair             | `POST /api/v1/connections/devices/pair`                 |
| Disconnect       | `POST /api/v1/connections/devices/:deviceId/disconnect` |
| Prepare sign     | `POST /api/v1/connections/sign/prepare`                 |
| Confirm sign     | `POST /api/v1/connections/sign/confirm`                 |

## Providers

- `simulator` — multi-capability simulator (default in development)
- `ledger_sim` — Ledger-style hardware simulation
- `walletconnect_sim` — WalletConnect-style sessions

Register additional providers without changing `ConnectionsEngineService`.

## Security

- Private keys never leave the hardware device (simulator emits signatures only)
- Session URIs and signatures stored encrypted (`CONNECTIONS_FIELD_ENCRYPTION_KEY`)
- Explicit confirmation required before signing
- Firmware compatibility flags persisted on pair
- Secrets never logged

## Workers

Gated by `CONNECTIONS_WORKERS_ENABLED`: connection monitor, session monitor, device health, sync, retry queue, provider health.
