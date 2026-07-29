# 06 — Staking Module

**Surface:** `/staking` (`StakingExperience`)

## Dashboard

Totals, rewards chart (`LineChart`), positions, validator browser with APY / risk, stake · unstake · claim flows with review + progress + success.

## UX notes

- Wide shell for density without dashboard KPI sprawl
- Cooldown / lock reassure copy on shell
- Preview warnings humanized when API fails

## Next (documented, not blocking)

Unbonding timeline UI, gas on claim, slashing education panel, live history from activity store.

## Code

`apps/web/src/components/trading/StakingExperience.tsx`
