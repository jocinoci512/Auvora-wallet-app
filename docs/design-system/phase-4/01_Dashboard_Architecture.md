# 01 — Dashboard Architecture

**Surface:** `/dashboard` (`DashboardExperience`)  
**Design language:** Aether (Phases 1–3)

## Hierarchy (top → bottom)

1. Header — identity, wallet selector, network, search, notifications, settings
2. Portfolio summary — serif balance, P&L, range chart, allocation
3. Quick actions — Send / Receive / Swap / Buy primary; Sell / Stake / Bridge / NFTs secondary
4. Asset list — favorites, sort/filter, expandable rows + sparklines
5. Recent activity — day-grouped timeline + filters
6. Market snapshot — gainers, losers, macro context
7. Watchlist
8. Collectibles (NFT strip)
9. Security status — health score + recommendations

## Principles applied

- Balance-first centerpiece (not KPI card wall)
- Primary verbs above secondary chrome
- Luxurious spacing via Aether Mist/Lagoon tokens
- Dark mode as flagship deep mineral canvas
- Live market fetch preserved with demo fallback

## Code

- `apps/web/src/components/dashboard/DashboardExperience.tsx`
- `apps/web/src/app/wallet-dashboard.css`
- Data: `lib/dashboard-demo.ts` + market-data API
