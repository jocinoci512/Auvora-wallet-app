# Bridge Provider Guide

**Phase:** 24  
**Service:** `@auvora/bridge-service` (port **3017**)

## Interface

Implement `BridgeProviderPort`:

- `getSupportedNetworks()` — include unsupported networks with reasons (e.g. Bitcoin)
- `listRoutes()` / `getSupportedAssets()`
- `getQuote()` / `prepareTransfer()` / `executeTransfer()` / `getExecutionStatus()`
- `healthCheck()`

## Built-in providers

| Code            | Priority | Notes                           |
| --------------- | -------- | ------------------------------- |
| `simulator`     | 100      | Multi-route simulator (default) |
| `layerzero_sim` | 80       | EVM-focused; Tron unsupported   |
| `wormhole_sim`  | 70       | Prefers Solana routes           |

Register additional adapters in `BridgeProviderRegistry` without changing `BridgeEngineService`.

## Resilience

- Per-call timeout (`BRIDGE_PROVIDER_TIMEOUT_MS`)
- Quote collection across providers with graceful skip on failure
- Best quote selected by amount-out then ETA
- Registry health is healthy if **any** provider is healthy
