# Alchemy Configuration

**Status:** Primary blockchain infrastructure for enabled mainnets  
**Service:** `@auvora/blockchain-service`

ALCHEMY is the **default primary** provider for Ethereum, Polygon, BNB Smart Chain, Solana, Tron, and Bitcoin mainnets. Simulators remain only as local/dev fallback when credentials are absent (or when `BLOCKCHAIN_PRIMARY_PROVIDER=simulator`).

## Environment variables

Validated by `services/blockchain/src/config/env.schema.ts`. Put secrets in root `.env` only (gitignored).

| Variable                       | Required | Description                                                      |
| ------------------------------ | -------- | ---------------------------------------------------------------- |
| `BLOCKCHAIN_PRIMARY_PROVIDER`  | No       | `alchemy` (default) or `simulator`                               |
| `ALCHEMY_API_KEY`              | Yes*     | Shared key used to construct default per-chain URLs              |
| `ALCHEMY_ETHEREUM_RPC_URL`     | No*      | Explicit Ethereum JSON-RPC URL override                          |
| `ALCHEMY_POLYGON_RPC_URL`      | No*      | Explicit Polygon JSON-RPC URL override                           |
| `ALCHEMY_BSC_RPC_URL`          | No*      | Explicit BNB Smart Chain JSON-RPC URL                            |
| `ALCHEMY_SOLANA_RPC_URL`       | No*      | Explicit Solana JSON-RPC URL                                     |
| `ALCHEMY_TRON_RPC_URL`         | No*      | Explicit Tron JSON-RPC / HTTP base URL                           |
| `ALCHEMY_BITCOIN_RPC_URL`      | No*      | Explicit Bitcoin JSON-RPC URL                                    |
| `ALCHEMY_RPC_TIMEOUT_MS`       | No       | Per-request timeout (default `12000`)                            |
| `ALCHEMY_REQUIRED`             | No       | When `true`, service refuses to boot without Alchemy credentials |
| `BLOCKCHAIN_SIMULATOR_ENABLED` | No       | Must be `false` in production                                    |

\* At least one of API key or an explicit URL is required to activate live providers.  
In **production** with primary=`alchemy`, missing credentials hard-fail unless `ALCHEMY_REQUIRED=false`.

## Centralized config

Runtime policy lives in:

- `services/blockchain/src/config/blockchain.config.ts` — enabled mainnets, network metadata, `resolveBlockchainConfig()`
- `services/blockchain/src/infrastructure/providers/alchemy/alchemy-rpc.config.ts` — URL resolution + redaction
- `services/blockchain/src/infrastructure/providers/multi-chain-provider.manager.ts` — network switching / backend selection

## URL resolution

Implemented in `resolveAlchemyRpcUrls()`:

1. If `ALCHEMY_<CHAIN>_RPC_URL` is set → use it.
2. Else if `ALCHEMY_API_KEY` is set →  
   `https://<alchemy-host>/v2/<ALCHEMY_API_KEY>`
3. Else → chain stays on the simulator provider (dev only).

Default hosts:

| Chain           | Host                            |
| --------------- | ------------------------------- |
| Ethereum        | `eth-mainnet.g.alchemy.com`     |
| Polygon         | `polygon-mainnet.g.alchemy.com` |
| BNB Smart Chain | `bnb-mainnet.g.alchemy.com`     |
| Solana          | `solana-mainnet.g.alchemy.com`  |
| Tron            | `tron-mainnet.g.alchemy.com`    |
| Bitcoin         | `bitcoin-mainnet.g.alchemy.com` |

**Ops note:** Enable each network on the Alchemy app dashboard. If Polygon returns HTTP 403 `MATIC_MAINNET is not enabled`, turn on Polygon in the app settings — code already constructs the host.

## Local setup

1. Copy `.env.example` → `.env`.
2. Set `ALCHEMY_API_KEY` (never commit the real value).
3. Set `BLOCKCHAIN_PRIMARY_PROVIDER=alchemy` and `BLOCKCHAIN_SIMULATOR_ENABLED=false`.
4. Restart the blockchain service so the registry rebuilds.

```bash
# Live connectivity probe (redacts the key in output)
node scripts/verify-alchemy-rpc.mjs
node scripts/verify-alchemy-live.mjs

# Service
pnpm --filter @auvora/blockchain-service dev
```

## Security

- Never commit real keys or populated RPC URLs.
- `.env.example` contains **empty** placeholders only.
- Logs use `redactRpcUrl()` / provider labels — API keys must not appear in log lines.
- Wallet / gateway services must not receive Alchemy env vars for outbound RPC; they call blockchain via `BLOCKCHAIN_SERVICE_URL`.
- **Mobile release APKs must not** inject `ALCHEMY_API_KEY` via `--dart-define` (binary-extractable). Keep the key server-side; mobile Alpha uses public RPC tip probes.
- If a key was pasted into chat or tickets, rotate it in the Alchemy dashboard.

## Error handling

`JsonRpcClient` classifies:

| Condition                                | Behavior                              |
| ---------------------------------------- | ------------------------------------- |
| Missing / invalid API key (HTTP 401/403) | `JsonRpcError` kind `auth`            |
| Rate limit (HTTP 429)                    | Retry with backoff; kind `rate_limit` |
| Upstream 5xx / network outage            | Retry; kind `upstream` / `network`    |
| Timeout                                  | kind `timeout`                        |

## Verification

```http
GET http://127.0.0.1:3003/health/providers
```

Expect `alchemyConfigured: true` and `backend: "alchemy"` for enabled mainnets when RPC responds.
