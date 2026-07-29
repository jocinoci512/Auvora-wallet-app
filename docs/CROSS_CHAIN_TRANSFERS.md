# Cross-Chain Transfers

**Phase:** 24  
**Service:** `@auvora/bridge-service` (port **3017**)

## Supported combinations (simulator)

Compatible pairs among:

- Ethereum ↔ BNB Smart Chain
- Ethereum ↔ Solana
- BNB Smart Chain ↔ Solana
- Ethereum ↔ Tron (simulator / wormhole; LayerZero-sim excludes Tron)

Unsupported routes are exposed gracefully rather than crashing the API.

## Transfer lifecycle

1. **Quote** — fee, ETA, route summary, alternatives count
2. **Prepare** — simulation + `PENDING_CONFIRMATION` transfer
3. **Confirm** — user confirmation required; creates receipt; status `BRIDGING`
4. **Sync / worker** — polls provider until `COMPLETED` or `FAILED`
5. **History / receipt** — encrypted payload + tx hashes

## UI

Web `/bridge`: source/destination selectors, asset, amount, quote, fee breakdown, confirm, progress, success/failure, history.  
Admin `/bridge`: providers, routes, failure analytics, sync, workers.
