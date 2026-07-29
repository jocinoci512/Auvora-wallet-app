# Routing Engine

**Phase:** 20  
**Service:** `@auvora/swap-service`

## Purpose

`RoutingEngineService` compares multi-provider routes and surfaces the best candidate without coupling callers to a vendor.

## Flow

1. Validate network (Bitcoin returns structured unsupported stub).
2. Collect routes from every provider that advertises support for the network.
3. Sort by `amountOut` desc, then `priceImpactBps` asc.
4. Swap Engine persists route snapshots (`SwapRouteSnapshot`) with `isBest` flag.

## Comparison policy

```
best = max(amountOut); ties → min(priceImpactBps)
```

Graceful degradation: provider timeouts/errors are logged and skipped; if no routes remain, quote fails with a clear domain error.

## Bitcoin stub

```json
{
  "supported": false,
  "architecture": "future_otc_or_bridge",
  "routes": [],
  "bestRoute": null
}
```
