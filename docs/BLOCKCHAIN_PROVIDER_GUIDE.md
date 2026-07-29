# Blockchain Provider Guide

**Phase:** 25 — Live Alchemy wiring & chain verification  
**Audience:** Platform engineers extending or operating chain providers

## Architecture rule

Wallet Core and other product services **never** call Alchemy (or any RPC vendor) directly.

```
Wallet / Payments / Admin
        │  HTTP (BLOCKCHAIN_SERVICE_URL)
        ▼
Blockchain Service (Nest)
        │  BlockchainProvider port
        ▼
Provider Registry ──► Alchemy live providers (primary for ETH/BSC/SOL/TRON/BTC)
                   └► Simulator providers (dev fallback / unsupported chains)
                              ▲
                   MultiChainProviderManager (network switch + backend select)
```

Application code depends only on `BlockchainProvider` (`services/blockchain/src/domain/blockchain/provider.port.ts`).  
`ProviderResolver` delegates to `MultiChainProviderManager` for the active primary backend.

## Contract (`BlockchainProvider`)

Every provider must implement:

| Capability                | Method                                 |
| ------------------------- | -------------------------------------- |
| Chain id                  | `getChain()`                           |
| Address create / validate | `createAddress()`, `validateAddress()` |
| Balance                   | `getBalance()`                         |
| Tip height                | `getBlockHeight()`                     |
| Tx lookup                 | `getTransaction()`                     |
| Broadcast                 | `broadcastTransaction()`               |
| Fees                      | `estimateFee()`                        |
| Network status            | `getNetworkStatus()`                   |
| Confirmations             | `getConfirmations()`                   |
| Watch                     | `watchAddress()`                       |
| Health                    | `healthCheck()`                        |

Live Alchemy providers also expose:

- `getRpcMetrics()` — request / error / retry / latency counters
- `getSafeEndpoint()` — redacted label suitable for logs

Chain-specific helpers (not on the shared port):

- EVM: `getTokenBalance`, `getChainId`, `estimateGas`, `getAssetTransfers`
- Solana: `getTokenBalance`, `getRecentBlockhash`, `getSignatureStatuses` (DAS stays on NFT service)
- Tron: `getTokenBalance`, `estimateResources`
- Bitcoin: `getUtxos`

## Registration

`InfrastructureModule` builds the registry from Nest simulator providers, then **overrides** every Alchemy-configured enabled mainnet via `createAlchemyProviders(env)` when `BLOCKCHAIN_PRIMARY_PROVIDER=alchemy` (default).

Centralized policy: `services/blockchain/src/config/blockchain.config.ts`.

Supported Alchemy chains: Ethereum, BNB Smart Chain, Solana, Tron, Bitcoin.  
Polygon and Litecoin remain on simulator providers unless separately wired.

## Phase 25 verification status

| Check                                     | Status                                    |
| ----------------------------------------- | ----------------------------------------- |
| Env URL construction from API key         | Verified                                  |
| Five-chain Alchemy init                   | Verified (mocked + gated live)            |
| Provider health `syncMode` / `errorState` | Verified                                  |
| Admin live RPC dashboard                  | Verified                                  |
| Product services call Alchemy directly    | Forbidden / audited clean for wallet path |

## Adding a new live vendor

1. Implement `BlockchainProvider` under `infrastructure/providers/<vendor>/`.
2. Resolve endpoints from env only (never hardcode secrets).
3. Register in the `PROVIDER_REGISTRY` factory **after** simulators so live wins.
4. Keep Wallet Core on `BLOCKCHAIN_SERVICE_URL` only.
5. Add mocked integration tests + document env vars in `.env.example`.

## Observability

- Structured Nest logs on registry boot and RPC retries (URLs redacted).
- OpenTelemetry spans on each JSON-RPC method (`rpc.<method>`).
- In-process metrics via `JsonRpcMetrics` surfaced on `/health/providers`.

## Related docs

- [ALCHEMY_INTEGRATION.md](./ALCHEMY_INTEGRATION.md)
- [PROVIDER_CONFIG.md](./PROVIDER_CONFIG.md)
- [NETWORK_HEALTH_REPORT.md](./NETWORK_HEALTH_REPORT.md)
- [ALCHEMY_CONFIGURATION.md](./ALCHEMY_CONFIGURATION.md)
- [NETWORK_SUPPORT.md](./NETWORK_SUPPORT.md)
- [RPC_HEALTH_REPORT.md](./RPC_HEALTH_REPORT.md)
