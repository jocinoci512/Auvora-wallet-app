# Web3 Connectivity

**Phase:** 26  
**Service:** `@auvora/connections-service` (port **3016**)  
**Gateway:** `/api/v1/connections/*` and `/api/v1/admin/connections/*`

## Purpose

Production-grade Web3 connectivity so Auvora Wallet users can securely connect to decentralized applications without coupling business logic to a single connection protocol.

All signing and session work goes through the **Connection Provider Port** (`simulator`, `ledger_sim`, `walletconnect_sim`, and future live adapters).

## Supported networks

| Network         | Connectivity                   | Notes                       |
| --------------- | ------------------------------ | --------------------------- |
| Ethereum        | Full                           | Connect, sign, switch       |
| BNB Smart Chain | Full                           | Connect, sign, switch       |
| Solana          | Full                           | Connect, sign               |
| Tron            | Full (where provider supports) | Connect, sign               |
| Bitcoin         | Read-only architecture         | No dApp transaction signing |

Status endpoint: `GET /api/v1/connections/web3/status`

## Platform integrations

- **Wallet Engine** — account selection on approve
- **Blockchain Provider Framework** — network validation via `ChainNetwork`
- **Hardware Wallet Platform** — hardware `kind` on signing
- **Swap / NFT / Bridge / Staking** — dApps may request sessions; signing remains permission-gated
- **Notification Platform** — connection request alerts
- **Analytics Platform** — connection / approval / signing latency events
- **AI Platform** — event publishing hooks (no secrets)

## Security

- Origin normalization and validation
- Replay protection via unique `proposalNonce`
- Permission isolation per user + origin + permission code
- Session encryption for WalletConnect URIs (existing field encryption)
- Safe transaction / typed-data previews (payload hashed; secrets never logged)
- Bitcoin cannot be granted `REQUEST_TRANSACTIONS`

## Background workers

| Worker             | Role                                                    |
| ------------------ | ------------------------------------------------------- |
| Session monitor    | Expires WC sessions + dApp requests + permission grants |
| Permission sync    | Counts pending requests / active grants                 |
| Connection monitor | Tracks connected external wallets                       |
| Retry queue        | Processes pending connection retries                    |
| Health worker      | Provider health snapshots                               |

## Observability

Tracked via analytics events and admin dashboards:

- Connection latency (provider health `latencyMs`)
- Approval latency (`approvalLatencyMs` on approve)
- Signing latency (engine prepare/confirm)
- Session duration (`expiresAt` / TTL)
- Provider health + worker job durations

## Related docs

- [DAPP_PLATFORM.md](./DAPP_PLATFORM.md)
- [PERMISSION_SYSTEM.md](./PERMISSION_SYSTEM.md)
- [SESSION_MANAGEMENT.md](./SESSION_MANAGEMENT.md)
- [WALLETCONNECT_GUIDE.md](./WALLETCONNECT_GUIDE.md)
