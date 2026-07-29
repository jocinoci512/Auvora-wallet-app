# 05 — Buy / Sell System

**Surfaces:** `/buy`, `/sell`

## Buy

Asset, fiat amount, method (card / bank / provider), fee labels, KYC notice, confirm → progress → success. History tab for prior purchases.

## Sell

Asset + balance, amount, destination, fee %, settlement ETA, irreversible warning, confirm → progress → success.

## Trust refinements

- Reassure copy is plain language (no `humanizeError(null, …)` misuse)
- Fees visible before confirm
- Provider list future-ready for live on-ramp / off-ramp SDKs

## Preserved

`pushTradingActivity`, `DEMO_BUY_PROVIDERS`, demo execution timers.

## Code

- `BuyExperience.tsx` · `SellExperience.tsx`
- `lib/trading/activity.ts`
