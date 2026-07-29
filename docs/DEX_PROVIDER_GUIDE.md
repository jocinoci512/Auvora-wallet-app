# DEX Provider Guide

**Phase:** 20  
**Audience:** Engineers adding or operating swap aggregators

## Architecture rule

Application services depend only on `SwapProviderPort` (`services/swap/src/domain/swap-provider.port.ts`).

```
Web / Admin / Wallet
        │  HTTP (gateway → SWAP_SERVICE_URL)
        ▼
Swap Engine / Routing Engine
        │  SwapProviderPort
        ▼
Provider Registry ──► simulator / zeroex_sim / jupiter_sim / (future live vendors)
```

## Port contract

Every provider implements:

| Method                 | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `getSupportedNetworks` | Capability matrix (incl. unsupported reasons) |
| `getSupportedAssets`   | Native + token catalog                        |
| `getQuote`             | Single best quote for request                 |
| `getRoutes`            | Candidate routes                              |
| `buildTransaction`     | Unsigned/safe tx payload + simulation flag    |
| `getExecutionStatus`   | Provider execution reference status           |
| `healthCheck`          | Liveness + latency                            |

## Bundled providers

| Code          | Scope               |
| ------------- | ------------------- |
| `simulator`   | ETH, BSC, SOL, TRON |
| `zeroex_sim`  | ETH, BSC            |
| `jupiter_sim` | SOL                 |

Bitcoin is listed as **not swap-supported** (`future_otc_or_bridge`) for architecture readiness.

## Adding a live vendor

1. Implement `SwapProviderPort` under `infrastructure/providers/`.
2. Register in `SwapProviderRegistry` constructor list.
3. Resolve API keys from env only.
4. Keep retries/timeouts via registry `withTimeout`.
5. Add provider unit tests + update this guide.
