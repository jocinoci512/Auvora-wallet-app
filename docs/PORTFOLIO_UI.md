# Portfolio UI

**App:** `@auvora/web`  
**Routes:** `/portfolio`, `/market/portfolio` (shared experience)  
**Phase:** Task 028  
**Component:** `apps/web/src/components/portfolio/PortfolioExperience.tsx`

## Capabilities

| Feature              | Behavior                                         |
| -------------------- | ------------------------------------------------ |
| Multi-wallet totals  | Distinct wallet count from holdings              |
| Multi-network totals | Distinct network count                           |
| Performance chart    | Weekly SVG line                                  |
| Allocation chart     | Donut by value                                   |
| Asset cards          | Avatar, value, 24h change                        |
| Expandable positions | Keyboard-friendly toggle; sparkline + P/L detail |
| Search               | Symbol, name, network, wallet label              |
| Filter               | Network select                                   |
| Sort                 | Value, 24h change, allocation, symbol            |
| P/L visualization    | Unrealized USD + % (cost basis when present)     |

## Visual language

Same tokens and `dashboard.css` density as the consumer dashboard — elegant, minimal, no oversized cards.

## Data

Demo holdings in `dashboard-demo.ts` (aligned with market-data portfolio intelligence shapes). Wire live `POST .../dashboards/portfolio-overview` when wallet holdings are available from the engine.

## Accessibility

- Search region `role="search"`
- Expanded state via `aria-expanded`
- Screen-reader-only labels on filter controls
- Tabular numeric values for readability
