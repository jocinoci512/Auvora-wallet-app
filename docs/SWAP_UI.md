# Swap UI

**Route:** `/swap`  
**Component:** `apps/web/src/components/trading/SwapExperience.tsx`

## Features

| Capability                                  | Implementation                                                 |
| ------------------------------------------- | -------------------------------------------------------------- |
| Token selector                              | Searchable sell/buy picker                                     |
| Network selector                            | Capability chips from `/api/v1/swaps/networks` (demo fallback) |
| Quote display                               | Amount out, min received, provider                             |
| Price impact                                | `priceImpactBps` → percent                                     |
| Route visualization                         | Hop chips from `routeSummary`                                  |
| Slippage / deadline                         | Advanced settings panel                                        |
| Gas estimation                              | `estimatedFeeNative`                                           |
| Confirmation / progress / success / failure | Screen machine                                                 |
| History tab                                 | Demo recent swaps + link to `/activity`                        |
| Animations                                  | Progress bar + page fade (`trading-experience.css`)            |
| Market context                              | Lightweight `LineChart` sparkline                              |

## API

- Live: `GET /swaps/networks`, `GET /swaps/assets`, `POST /swaps/quote`, prepare/execute when available
- Offline: simulator quote so the workflow remains completable

## Accessibility

- `role="main"`, tablist for Swap/History, radiogroups for networks, labelled amount inputs
