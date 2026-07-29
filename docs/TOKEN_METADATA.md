# Token Metadata

**Service:** `@auvora/market-data-service` → `TokenMetadataService`  
**Phase:** 19

## Fields

Name, symbol, logo URL, decimals, contract address, network, token type (`AssetStandard`), verification status (`UNVERIFIED` / `VERIFIED` / `SUSPICIOUS`), circulating / total / max supply, external IDs (e.g. CoinGecko).

## Persistence

Prisma model `AssetMarketMetadata` with optional link to ledger `Asset`. Local Redis cache key `md:meta:{network}:{symbol}`.

## Sync

- On-demand via `GET /api/v1/market-data/metadata`
- Background metadata worker (`MARKET_DATA_METADATA_INTERVAL_MS`)
- Admin force sync `POST /api/v1/admin/market-data/sync/metadata`

Native seeds: BTC, ETH, BNB, SOL, TRX on their respective networks.
