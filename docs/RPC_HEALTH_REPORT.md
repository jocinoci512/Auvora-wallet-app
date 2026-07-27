# RPC Health Report

**Phase:** 17  
**Generated for:** Alchemy live provider integration

## Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /health` | Public | Process liveness |
| `GET /ready` | Public | DB + Redis readiness |
| `GET /health/providers` | Public | All chain RPC probes |
| `GET /health/providers/:chain` | Public | Single chain probe |
| `GET /api/v1/blockchain/providers/health` | JWT + `blockchain:read` | Same probe via API |
| `GET /api/v1/blockchain/providers/:chain/health` | JWT + `blockchain:read` | Single chain via API |
| `GET /api/v1/admin/blockchain/health` | Admin | Historical health rows (DB) |

Blockchain service default port: **3003**.  
Gateway aggregates platform health at `http://localhost:4000/health` (does not replace per-provider RPC probes).

## Probe payload fields

| Field | Meaning |
|-------|---------|
| `status` | `up` \| `degraded` \| `down` |
| `backend` | `alchemy` \| `simulator` |
| `latencyMs` | Last health probe latency |
| `latestBlockHeight` | Tip height / slot as string |
| `synchronized` | Tip height &gt; 0 |
| `lastSuccessfulRpc` | ISO timestamp from metrics or last healthy probe |
| `endpoint` | Safe label (never includes API key) |
| `metrics` | requests, errors, retries, totalLatencyMs, last error snippet |

## Expected Phase 17 outcomes

| Chain | When Alchemy configured + RPC healthy | When unset |
|-------|----------------------------------------|------------|
| Ethereum | `backend=alchemy`, `status=up` | `backend=simulator` |
| BNB Smart Chain | `backend=alchemy`, `status=up` | `backend=simulator` |
| Solana | `backend=alchemy`, `status=up` | `backend=simulator` |
| Tron | `backend=alchemy`, `status=up` | `backend=simulator` |
| Bitcoin | `backend=alchemy`, `status=up`* | `backend=simulator` |
| Polygon / Litecoin | simulator | simulator |

\* Bitcoin balance/UTXO may degrade on tiers without `scantxoutset`; tip health can still be `up`.

## CI / automated coverage

Mocked integration tests (no real Alchemy key required):

- RPC connectivity (success path)
- Balance retrieval
- Address validation
- Transaction retrieval
- Latest block retrieval
- Provider preference (Alchemy overrides simulator when configured)
- Retry behavior
- Timeout behavior

Package: `@auvora/blockchain-service` — files under `src/infrastructure/providers/alchemy/*.spec.ts`.

## Operator checklist

1. Confirm `.env` has Alchemy placeholders filled locally (not committed).
2. Restart blockchain service.
3. Hit `GET http://127.0.0.1:3003/health/providers`.
4. Confirm five Phase-17 chains show `alchemy` when a key/URL is present.
5. Confirm logs never contain the raw API key.
