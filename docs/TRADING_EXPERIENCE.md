# Trading Experience

**Task:** 030 — Premium Trading Experience  
**App:** `apps/web`  
**Figma:** [Auvora Design System](https://www.figma.com/design/<YOUR_FIGMA_FILE_KEY>) → page **Trading Experience**

## Principles

- Code + `@auvora/ui` remain the source of truth; Figma is a publish target.
- Existing swap / bridge / staking / payments APIs are reused (raw gateway fetch + demo fallback).
- Shared visual language via `trading-experience.css` + Task 028/029 patterns.
- Completed trades append to local trading activity and merge into `/activity`.

## Surfaces

| Flow | Route | Component |
|------|-------|-----------|
| Swap | `/swap` | `SwapExperience` |
| Bridge | `/bridge` | `BridgeExperience` |
| Buy | `/buy` | `BuyExperience` |
| Sell | `/sell` | `SellExperience` |
| Staking | `/staking` | `StakingExperience` |

## Portfolio integration

- Success screens deep-link to `/portfolio` and `/activity`
- `pushTradingActivity` → `tradingAsActivityTx` merges into `TransactionHistoryExperience`
- Dashboard quick actions: Swap, Bridge, Buy, Sell, Stake

## Shared helpers

- `lib/trading/api.ts` — timed JSON fetch + fee/ETA formatters  
- `lib/trading/activity.ts` — local activity store + demo datasets  

## Related docs

- [`SWAP_UI.md`](./SWAP_UI.md)
- [`BRIDGE_UI.md`](./BRIDGE_UI.md)
- [`BUY_SELL_UI.md`](./BUY_SELL_UI.md)
- [`STAKING_UI.md`](./STAKING_UI.md)
