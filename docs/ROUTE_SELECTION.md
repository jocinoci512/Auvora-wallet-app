# Route Selection

**Phase:** 24

## Discovery

`GET /api/v1/bridge/routes` merges routes from all providers. Unsupported routes (e.g. Bitcoin → Ethereum) are returned with `supported: false` and a `reason` instead of hard-failing the catalog.

## Quote selection

1. Validate source ≠ destination and positive amount
2. Collect quotes from all healthy-capable providers
3. Sort by `amountOut` desc, then `estimatedCompletionSeconds` asc
4. Persist winning quote with `replayNonce` and TTL

## Provider prioritization

Providers declare `priority`. The registry lists them highest-first for health/admin views. Quote selection prefers economics (output) over static priority so users get the best fill.

## Bitcoin stance

Bitcoin is listed as `bridgeSupported: false` with architecture reserved for future OTC/wrapped rails. Quoting BTC routes returns `BRIDGE_UNSUPPORTED_ROUTE`.
