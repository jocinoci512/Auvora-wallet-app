# Staking Engine

**Phase:** 22 — Enterprise Staking & Yield Platform  
**Service:** `@auvora/staking-service` (port **3015**)

## Overview

The Staking Engine lets users stake supported assets, unstake (including partial), claim rewards, select validators, and track positions — all behind a provider abstraction (`StakingProviderPort`).

Clients call the gateway (`/api/v1/staking`). Business logic never depends on a single vendor.

## Capabilities

| Capability                        | Endpoint                                            |
| --------------------------------- | --------------------------------------------------- |
| Networks                          | `GET /api/v1/staking/networks`                      |
| Validators                        | `GET /api/v1/staking/validators?network=`           |
| Estimate                          | `POST /api/v1/staking/estimate`                     |
| Prepare stake                     | `POST /api/v1/staking/stake/prepare`                |
| Prepare unstake                   | `POST /api/v1/staking/unstake/prepare`              |
| Prepare claim                     | `POST /api/v1/staking/claim/prepare`                |
| Confirm (required before execute) | `POST /api/v1/staking/confirm`                      |
| Positions / rewards / analytics   | `GET .../positions`, `.../rewards`, `.../analytics` |

## Security

- Explicit `confirmed: true` required before execution
- Input validation via DTOs
- Provider simulation check (`simulationOk`) before prepare succeeds
- Secrets never logged; internal routes key-guarded

## Workers

Gated by `STAKING_WORKERS_ENABLED`: reward sync, validator sync, position sync, reward calculation, retry queue, health worker.
