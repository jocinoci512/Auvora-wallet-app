# Validator Guide

**Phase:** 22 — Staking & Yield Platform  
**Port:** `StakingProviderPort.listValidators` / `getValidator`

## Capabilities

- Discovery per network
- Search by name / id / address (`q`)
- Ranking via `performanceScore` (APY + uptime − commission)
- Commission, APY, uptime, status, delegation totals

## Built-in providers

| Code           | Role                             |
| -------------- | -------------------------------- |
| `simulator`    | Multi-network fixture validators |
| `lido_sim`     | ETH liquid-staking style         |
| `marinade_sim` | Solana stake-pool style          |

## Unsupported networks

Bitcoin (and any network without a supporting provider) returns `stakingSupported: false` with a reason — no hard error on capability listing.
