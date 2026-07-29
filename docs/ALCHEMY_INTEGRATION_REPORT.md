# Alchemy Integration Report

**Date:** 2026-07-26  
**Scope:** Primary Alchemy infrastructure for Ethereum, Solana, BNB Smart Chain, Tron, and Bitcoin mainnets  
**Service boundary:** `@auvora/blockchain-service` (Wallet/Gateway never call Alchemy directly)

## Summary

Alchemy is configured as the **default primary** blockchain provider for the five enabled mainnets. Credentials load from environment variables only. A centralized config module, per-chain Alchemy adapters, and a multi-chain provider manager select the correct live backend at runtime. Live RPC probes for all five networks succeeded.

## Networks configured

| Network                 | Endpoint host                   | Provider class           | Client stack         |
| ----------------------- | ------------------------------- | ------------------------ | -------------------- |
| Ethereum Mainnet        | `eth-mainnet.g.alchemy.com`     | `AlchemyEvmProvider`     | EVM JSON-RPC         |
| BNB Smart Chain Mainnet | `bnb-mainnet.g.alchemy.com`     | `AlchemyEvmProvider`     | EVM JSON-RPC         |
| Solana Mainnet          | `solana-mainnet.g.alchemy.com`  | `AlchemySolanaProvider`  | Solana JSON-RPC      |
| Tron Mainnet            | `tron-mainnet.g.alchemy.com`    | `AlchemyTronProvider`    | Tron JSON-RPC + HTTP |
| Bitcoin Mainnet         | `bitcoin-mainnet.g.alchemy.com` | `AlchemyBitcoinProvider` | Bitcoin JSON-RPC     |

## Services integrated

| Capability                                                  | Status                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Wallet create / import (address validation + chain routing) | Via blockchain `BlockchainProvider` + wallet engine HTTP client         |
| Native coin balances                                        | `getBalance` on all five Alchemy providers                              |
| Token balances                                              | EVM ERC-20/BEP-20, Solana SPL, Tron TRC-20 helpers                      |
| Transaction lookup                                          | `getTransaction`                                                        |
| Transaction broadcast                                       | `broadcastTransaction`                                                  |
| Fee / gas estimation                                        | `estimateFee` (EVM gas, Solana, Tron resources, BTC `estimatesmartfee`) |
| Address validation                                          | Shared domain rules per chain                                           |
| Block sync / tip                                            | `getBlockHeight` + sync jobs                                            |
| Network switching                                           | `MultiChainProviderManager.switchNetwork`                               |
| Provider health                                             | `/health/providers` + `JsonRpcClient` metrics                           |

## Files modified / added

### Core config & wiring

- `services/blockchain/src/config/blockchain.config.ts` — centralized enabled-mainnet + primary-provider policy
- `services/blockchain/src/config/blockchain.config.spec.ts` — unit tests
- `services/blockchain/src/config/load-root-env.ts` — load root `.env` without dotenv
- `services/blockchain/src/config/env.schema.ts` — `BLOCKCHAIN_PRIMARY_PROVIDER`, `ALCHEMY_REQUIRED`, Alchemy URL vars
- `services/blockchain/src/main.ts` — loads root env before Nest bootstrap
- `services/blockchain/src/infrastructure/infrastructure.module.ts` — Alchemy-primary registry policy
- `services/blockchain/src/infrastructure/providers/multi-chain-provider.manager.ts` — multi-chain manager
- `services/blockchain/src/infrastructure/providers/multi-chain-provider.manager.spec.ts`
- `services/blockchain/src/infrastructure/providers/provider-resolver.service.ts` — resolves via manager
- `services/blockchain/src/infrastructure/providers/alchemy/json-rpc.client.ts` — auth / rate-limit / timeout / network errors
- `services/blockchain/src/infrastructure/providers/alchemy/json-rpc.client.spec.ts` — timeout assertion update
- `database/seed/index.ts` — Alchemy provider records primary for five chains
- `.env.example` — primary provider + empty Alchemy placeholders
- `scripts/verify-alchemy-rpc.mjs` — live connectivity probe

### Existing Alchemy adapters (retained / used as primary)

- `services/blockchain/src/infrastructure/providers/alchemy/alchemy-rpc.config.ts`
- `services/blockchain/src/infrastructure/providers/alchemy/create-alchemy-providers.ts`
- `services/blockchain/src/infrastructure/providers/alchemy/alchemy-evm.provider.ts`
- `services/blockchain/src/infrastructure/providers/alchemy/alchemy-solana.provider.ts`
- `services/blockchain/src/infrastructure/providers/alchemy/alchemy-tron.provider.ts`
- `services/blockchain/src/infrastructure/providers/alchemy/alchemy-bitcoin.provider.ts`

### Documentation

- `docs/ALCHEMY_CONFIGURATION.md`
- `docs/BLOCKCHAIN_PROVIDER_GUIDE.md`
- `docs/NETWORK_SUPPORT.md`
- `docs/ALCHEMY_INTEGRATION_REPORT.md` (this file)

### Local secrets (not committed)

- Root `.env` — `ALCHEMY_API_KEY`, `BLOCKCHAIN_PRIMARY_PROVIDER=alchemy`, `BLOCKCHAIN_SIMULATOR_ENABLED=false`

## Verification results

| Check                                                  | Result                      |
| ------------------------------------------------------ | --------------------------- |
| Live RPC probe (`node scripts/verify-alchemy-rpc.mjs`) | All 5 networks HTTP 200     |
| `@auvora/blockchain-service` tests                     | 12 suites / 53 tests passed |
| Lint                                                   | Passed                      |
| Nest build                                             | Passed                      |

### Probe methods used

- Ethereum / BSC / Tron: `eth_blockNumber`
- Solana: `getHealth`
- Bitcoin: `getblockcount`

## Error handling

| Failure mode                                      | Handling                      |
| ------------------------------------------------- | ----------------------------- |
| Missing API key (dev)                             | Warning; simulators remain    |
| Missing API key (production / `ALCHEMY_REQUIRED`) | Hard fail at boot             |
| Invalid key (401/403)                             | `JsonRpcError` `auth`         |
| Rate limit (429)                                  | Retry + backoff; `rate_limit` |
| Upstream 5xx / outage                             | Retry; `upstream` / `network` |
| Timeout                                           | `timeout`                     |

## Security notes

- Credentials are environment-only; `.env.example` has empty placeholders.
- RPC URLs are redacted in logs (`redactRpcUrl`).
- Wallet service uses `BLOCKCHAIN_SERVICE_URL` only — no Alchemy key in wallet/gateway.
- **Rotate the API key** if it was shared in chat, tickets, or screenshots.

## Remaining recommendations (next build phase)

1. **Rotate** the Alchemy API key that was shared in plaintext and store the replacement only in `.env` / secret manager.
2. Add CI secret injection (`ALCHEMY_API_KEY`) for a scheduled live smoke job without printing URLs with keys.
3. Wire richer transaction-history pagination endpoints where Alchemy Enhanced APIs are licensed (keep wallet on blockchain HTTP).
4. Confirm Bitcoin `scantxoutset` / indexer tier on the Alchemy plan; add a dedicated UTXO indexer fallback if needed for production balances.
5. Consider Alchemy webhooks / Address Activity for push sync instead of polling-only.
6. Keep Polygon / Litecoin off primary until product enables them and Alchemy endpoints are provisioned.
7. Add OpenTelemetry dashboards for per-chain RPC error rates and p95 latency from `JsonRpcMetrics`.
