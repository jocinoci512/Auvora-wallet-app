# Staking UI

**Route:** `/staking`  
**Component:** `apps/web/src/components/trading/StakingExperience.tsx`

## Features

| Capability                    | Implementation                       |
| ----------------------------- | ------------------------------------ |
| Rewards dashboard             | KPI cards (staked, rewards, avg APY) |
| Reward charts                 | `LineChart` 7-day series             |
| Validator browser             | APY, commission, stake size          |
| Position details              | List with claim shortcut             |
| Stake / unstake / claim flows | Dedicated screens + confirm          |
| Progress / success            | Shared trading progress pattern      |
| History                       | Demo staking operations              |

## API

- Attempts `GET /api/v1/staking/positions`
- Falls back to curated demo positions/validators when offline

## Accessibility

- Tab controls for overview / stake / unstake / claim / history
- Form fields labelled; progress `aria-busy`
