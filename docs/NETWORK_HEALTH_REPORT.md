# Network Health Report (Phase 25)

Operational view of Alchemy-backed provider health for the five enabled mainnets.

## How to read health

| Field               | Meaning                            |
| ------------------- | ---------------------------------- |
| `status`            | `up` \| `degraded` \| `down`       |
| `backend`           | `alchemy` or `simulator`           |
| `syncMode`          | `live-backed` or `simulator-only`  |
| `latencyMs`         | Last health-check round-trip       |
| `latestBlockHeight` | Tip / slot / height as string      |
| `synchronized`      | Tip retrieved and &gt; 0           |
| `lastSuccessfulRpc` | ISO timestamp from RPC metrics     |
| `endpoint`          | Redacted provider label            |
| `errorState`        | Last probe / metrics error message |

## Endpoints

- Blockchain service: `GET /health/providers`
- Gateway (when proxied): `http://localhost:4000` → blockchain health routes as configured
- Admin live summary: `GET /api/v1/admin/blockchain/providers/rpc-health`
- Admin UI: http://localhost:3001/blockchain

## Expected healthy shape (Alchemy configured)

| Chain           | Backend | Notes                                       |
| --------------- | ------- | ------------------------------------------- |
| Ethereum        | alchemy | `eth_blockNumber` + `eth_chainId` in health |
| BNB Smart Chain | alchemy | Same EVM path, chainId 56                   |
| Solana          | alchemy | Slot + latest blockhash                     |
| Tron            | alchemy | Tip via JSON-RPC or `/wallet/getnowblock`   |
| Bitcoin         | alchemy | `getblockcount`; UTXO scan best-effort      |

When `ALCHEMY_API_KEY` is empty, all five fall back to simulators with `backend=simulator` and `syncMode=simulator-only`. That is a valid local development posture and does not fail CI.

## Observability

- Structured Nest logs on registry boot and RPC retries (URLs redacted).
- OpenTelemetry spans: `rpc.<method>` with `rpc.endpoint` attribute.
- In-process counters: requests, errors, retries, totalLatencyMs.

## Related

- [RPC_HEALTH_REPORT.md](./RPC_HEALTH_REPORT.md) — Phase 17 baseline
- [ALCHEMY_INTEGRATION.md](./ALCHEMY_INTEGRATION.md)
- [PROVIDER_CONFIG.md](./PROVIDER_CONFIG.md)
