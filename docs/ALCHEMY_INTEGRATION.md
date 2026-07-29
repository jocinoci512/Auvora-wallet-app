# Alchemy Integration (Phase 25)

**Audience:** Platform engineers wiring live RPC for Auvora Wallet  
**Scope:** Ethereum, BNB Smart Chain, Solana, Tron, Bitcoin via Alchemy behind `BlockchainProvider`

## Architecture rule

Product services (Wallet, Portfolio, Swap, NFT, Bridge, Staking, Market Data, Analytics) **never** call Alchemy HTTP/RPC directly.

```
Web / Admin / Wallet HTTP
        │
        ▼
Gateway → Blockchain Service
        │  BlockchainProvider port
        ▼
Provider Registry
   ├─ Alchemy live (primary when ALCHEMY_* configured)
   └─ Simulator (dev fallback / unsupported chains)
```

## Enabled mainnets

| Network         | Provider class           | Stack                                |
| --------------- | ------------------------ | ------------------------------------ |
| Ethereum        | `AlchemyEvmProvider`     | EVM JSON-RPC + Enhanced APIs         |
| BNB Smart Chain | `AlchemyEvmProvider`     | EVM JSON-RPC                         |
| Solana          | `AlchemySolanaProvider`  | Solana JSON-RPC                      |
| Tron            | `AlchemyTronProvider`    | JSON-RPC + Tron HTTP wallet fallback |
| Bitcoin         | `AlchemyBitcoinProvider` | Bitcoin JSON-RPC                     |

Polygon and Litecoin remain on simulator providers unless separately wired.

## Initialization

1. `resolveAlchemyRpcUrls(env)` builds per-chain URLs from `ALCHEMY_API_KEY` or explicit `ALCHEMY_*_RPC_URL`.
2. `createAlchemyProviders(env)` constructs live adapters.
3. `InfrastructureModule` overrides simulator entries when `BLOCKCHAIN_PRIMARY_PROVIDER=alchemy` (default).
4. Boot logs redacted endpoints only (`…/v2/[REDACTED]`).

## Verification surfaces

| Surface            | Path                                                    |
| ------------------ | ------------------------------------------------------- |
| Public live probes | `GET /health/providers`, `GET /health/providers/:chain` |
| Authenticated      | `GET /api/v1/blockchain/providers/health`               |
| Admin live RPC     | `GET /api/v1/admin/blockchain/providers/rpc-health`     |
| Admin UI           | http://localhost:3001/blockchain                        |

Each probe reports: `status`, `backend`, `syncMode`, `latencyMs`, `latestBlockHeight`, `lastSuccessfulRpc`, `endpoint`, `errorState`, metrics.

## Sync mode

- **live-backed:** Alchemy credentials present and simulator ledger sync off (`BLOCKCHAIN_SIMULATOR_ENABLED=false`).
- **simulator-only:** Local ledger tickers and/or no Alchemy credentials.

Tip height and RPC health always come from the active `BlockchainProvider`. Simulator ledger scans stay optional for local bookkeeping.

## Testing

- Mocked integration: `alchemy.providers.integration.spec.ts` (always runs in CI).
- Gated live: set `ALCHEMY_LIVE_TEST=true` plus `ALCHEMY_API_KEY` (or per-chain URLs).

## Related docs

- [PROVIDER_CONFIG.md](./PROVIDER_CONFIG.md)
- [BLOCKCHAIN_PROVIDER_GUIDE.md](./BLOCKCHAIN_PROVIDER_GUIDE.md)
- [NETWORK_HEALTH_REPORT.md](./NETWORK_HEALTH_REPORT.md)
- [ALCHEMY_CONFIGURATION.md](./ALCHEMY_CONFIGURATION.md)
