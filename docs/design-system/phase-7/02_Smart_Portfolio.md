# 02 — Smart Portfolio

## Purpose

Evolve `/portfolio` from a holdings list into a calm insight surface: allocation, performance, P/L, concentration signals, and health — without inventing a second portfolio page.

## Surface

- **Route:** `/portfolio`
- **Component:** `apps/web/src/components/portfolio/PortfolioExperience.tsx`
- **Data:** `lib/dashboard-demo.ts` holdings + performance (live when connected)

## Displays

| Signal                        | Where                                                |
| ----------------------------- | ---------------------------------------------------- |
| Total value + unrealized P/L  | Totals panel                                         |
| Realized gains                | Honest note → Activity (demo not booked)             |
| Best / worst 24h              | KPI row                                              |
| Historical performance        | Line chart                                           |
| Token allocation              | Donut + legend                                       |
| Network allocation            | List by network value                                |
| Concentration / health teaser | Health ring + insight highlights                     |
| Holdings detail               | Expandable asset cards with per-asset unrealized P/L |

## Design choices

- PlatformShell + existing dashboard chart primitives (no parallel chart system).
- Reassure strip: illustrative until live balances connect.
- Actions: Insights, Ask Assistant — education paths, not trade CTAs.

## Quality gates

| Gate                           | Status |
| ------------------------------ | ------ |
| Component consistency          | Pass   |
| Performance (client demo memo) | Pass   |
| Honesty about demo vs live     | Pass   |
| Mobile filters + cards         | Pass   |
