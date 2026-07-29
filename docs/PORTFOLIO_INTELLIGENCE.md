# Portfolio Intelligence

**Services:** `@auvora/market-data-service` (`PortfolioIntelligenceService`) + wallet `PortfolioEngineService` (extended)  
**Phase:** 19

## Calculations

- Total portfolio value (USD)
- Network breakdown + allocation %
- Token allocation + largest holdings
- Daily / weekly / monthly gain-loss (from 24h change)
- Unrealized P&L (when cost basis provided)
- Historical value snapshots (`PortfolioValueSnapshot`)

## Multi-wallet

Accepts holdings arrays with optional `walletId` per row. Wallet engine calls market-data internal valuation when `MARKET_DATA_SERVICE_URL` is set and enriches existing portfolio responses with fiat fields (non-breaking).

## Dashboards

| Dashboard          | Endpoint                                                 |
| ------------------ | -------------------------------------------------------- |
| Portfolio overview | `POST /api/v1/market-data/dashboards/portfolio-overview` |
| Asset allocation   | `POST /api/v1/market-data/dashboards/asset-allocation`   |
| Performance        | `POST /api/v1/market-data/dashboards/performance`        |
| Network breakdown  | `POST /api/v1/market-data/dashboards/network-breakdown`  |
| Top movers         | `GET /api/v1/market-data/dashboards/top-movers`          |
| Trending           | `GET /api/v1/market-data/dashboards/trending`            |
| Market overview    | `GET /api/v1/market-data/dashboards/market-overview`     |

## Workers

`MarketWorkersService` portfolio worker recalculates valuations for active wallet owners (via wallet internal HTTP when configured).
