# Yield Analytics

**Phase:** 22 — Staking & Yield Platform

## Dashboard metrics (`GET /api/v1/staking/analytics`)

- Active position count
- Total staked
- Pending + accumulated rewards
- Estimated portfolio APY (average across positions)
- Projected yearly earnings
- Portfolio staking allocation by network

## Position performance

Each position stores `apyPercent`, `pendingRewards`, `accumulatedRewards`, and sync timestamps for history and admin monitoring.
