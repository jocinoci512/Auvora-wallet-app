# Reward Engine

**Phase:** 22 — Staking & Yield Platform

## Flows

1. **Estimate** — provider APY → pending / daily / monthly / yearly projections
2. **Accrue** — reward sync worker increments `pendingRewards` on active positions
3. **Claim** — prepare → confirm → reward record `CLAIMED`, pending cleared, accumulated updated
4. **History** — `GET /api/v1/staking/rewards`

## Calculations

- `estimatedApyFromBps(bps) = bps / 100`
- `projectedEarnings(principal, apy%, days) = principal * apy% / 100 * days / 365`

## Notifications

Fire-and-forget to Notification Platform: stake/unstake success, reward available, reward claimed.
