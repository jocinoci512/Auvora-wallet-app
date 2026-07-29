# 07 — Bridge Module

**Surface:** `/bridge` (`BridgeExperience`)

## UI

Source / destination networks, flip, amount, quote + alternatives, fee / gas / ETA / provider, confirm, progress, success / failure, history.

## Trust refinements

- Progress stages: **Lock → Relay → Mint → Completed**
- Live prepare/confirm failures route to failure (no silent success)
- Humanized errors for stuck / refund / network cases via shared mapper

## Preserved

`tradingFetch` networks / quote / prepare / confirm + demo fallbacks.

## Code

`apps/web/src/components/trading/BridgeExperience.tsx`
