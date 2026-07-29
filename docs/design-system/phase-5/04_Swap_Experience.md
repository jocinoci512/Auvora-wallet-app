# 04 — Swap Experience

**Surface:** `/swap` (`SwapExperience`)

## UI

From / To, amount, flip, rate, provider, slippage, price impact, gas / fee, ETA, route chips, history tab.

## Backend (preserved)

`tradingFetch` for networks, assets, quote (polled on form), prepare, execute — with demo quote fallback.

## Trust refinements

- Live execute failures route to **failure** screen (no silent preview success)
- Errors pass through `humanizeError`
- Reassure: quotes refresh; nothing broadcasts until confirm

## Competitive stance

Parity with Phantom / Rainbow density on the form; Auvora differentiates with editorial calm, explicit review, and human failure copy — not neon route graphs.

## Code

`apps/web/src/components/trading/SwapExperience.tsx`
