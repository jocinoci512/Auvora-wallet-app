# Dashboard UI

**App:** `@auvora/web` (`/`)  
**Phase:** Task 028 — Premium Dashboard & Portfolio Experience  
**Design contract:** `docs/DESIGN_UPDATES.md`

## Purpose

Consumer wallet home — professionalism, trust, and financial insight without admin clutter.

## Entry

- Route: `/`
- Component: `apps/web/src/components/dashboard/DashboardExperience.tsx`
- Styles: `apps/web/src/app/dashboard.css`
- Nav label: **Dashboard**

## Sections

| Section             | Content                                                                               |
| ------------------- | ------------------------------------------------------------------------------------- |
| Hero                | Portfolio value (count-up), wallet/network counts                                     |
| KPIs                | Today / week / month P&L                                                              |
| Weekly performance  | SVG line chart                                                                        |
| Asset allocation    | Donut + legend                                                                        |
| Quick actions       | Receive, Send, Swap, Stake, Bridge, Buy, Sell, Connect dApp, View NFTs, Import Wallet |
| Top holdings        | Symbol, network, wallet, value, 24h                                                   |
| Recent transactions | Type, asset, status                                                                   |
| Price movers        | 24h changers                                                                          |
| Watchlist           | Linked to `/market/watchlist`                                                         |
| Market overview     | Snapshot + link to `/market`                                                          |
| Wallet health       | Backup / 2FA / risk                                                                   |
| Network status      | Chain health pills                                                                    |
| Price alerts        | Armed / near                                                                          |
| Activity modules    | NFT, staking, bridge, swap, dApps, notifications                                      |

## Data

1. Prefers live `GET /api/v1/market-data/overview` and `GET /api/v1/market-data/dashboards/top-movers` when available.
2. Falls back to curated demo holdings in `apps/web/src/lib/dashboard-demo.ts`.

## Motion

- Page fade-up
- Card hover lift (1px)
- Chart line draw-in
- Balance `CountUp` (respects `prefers-reduced-motion`)
- Skeleton shimmer while loading

## Accessibility

- Landmark headings per widget
- Skip link + `#main-content` from app shell
- Focus-visible on actions
- Charts expose `role="img"` + aria-label ranges
- Status badges for transaction state

## Responsive

12-column CSS grid collapsing to 6-col then 12-col; hero stacks under 900px.
