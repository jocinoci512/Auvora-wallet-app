# Market Data Engine

**Service:** `@auvora/market-data-service` (port `3012`)  
**Phase:** 19

## Overview

Provider-port market data platform for native coin and token pricing across Bitcoin, Ethereum, BNB Smart Chain, Solana, and Tron.

## Provider abstraction

| Port                     | Implementation                                             |
| ------------------------ | ---------------------------------------------------------- |
| `MarketDataProviderPort` | `domain/market-provider.port.ts`                           |
| Simulator (default)      | `SimulatorMarketProvider`                                  |
| CoinGecko                | `CoinGeckoMarketProvider` (graceful fallback to simulator) |
| Registry                 | `MarketProviderRegistry`                                   |

Capabilities: native/token prices, historical prices, OHLC, 24h change, market cap, volume, circulating supply, FDV, trending assets.

## API

| Method   | Path                                     | Notes                     |
| -------- | ---------------------------------------- | ------------------------- |
| GET      | `/api/v1/market-data/prices`             | `symbol` + `network`      |
| GET      | `/api/v1/market-data/trending`           | Trending assets           |
| GET      | `/api/v1/market-data/overview`           | Market overview           |
| GET      | `/api/v1/market-data/charts`             | OHLC chart ranges         |
| GET      | `/api/v1/market-data/observability`      | Latency / cache hit ratio |
| POST     | `/api/v1/internal/market-data/valuation` | Internal wallet valuation |
| GET/POST | `/api/v1/internal/market-data/quotes`    | Internal quotes           |

Gateway proxies `/api/v1/market-data` and `/api/v1/admin/market-data`.

## Caching

Redis keys: `md:price:*`, `md:trending`, `md:meta:*`, `md:portfolio:*` with configurable TTLs.

## Security

- Provider API keys never logged (`redactUrl`)
- Internal routes require `x-internal-api-key`
- Simulator enabled by default via `MARKET_DATA_SIMULATOR_ENABLED=true`

## Env

See `.env.example` (`MARKET_DATA_*`, `COINGECKO_*`, `MARKET_DATA_SERVICE_URL`).
