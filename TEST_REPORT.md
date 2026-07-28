# Test Report — Pre-Deployment Audit

**Date:** 2026-07-27

---

## Summary

| Suite | Result |
|-------|--------|
| Unit (`pnpm test`, 35 Turbo tasks) | **PASS** |
| Integration (`*integration*.spec.ts`, 8 services) | **PASS** (8/8) |
| E2E Nest health (`test:e2e`, 13 packages) | **PASS** (13/13) |
| Live funded mutation E2E | **NOT RUN** (requires staging mesh + keys) |

**Test status: PASS**

---

## Unit tests (sampled totals from this run)

Approximately **640** assertions/tests passed across packages/services (1 skipped: gated live Alchemy health probe).

Notable packages: AI (90), analytics (89), notifications (88), custody (51), compliance (39), blockchain (56 + 1 skipped).

Web/admin Jest often `passWithNoTests` — UI coverage relies more on journey/a11y smokes and App Router builds.

---

## Integration

Services exercised: blockchain, bridge, connections, market-data, nft, staking, swap, wallet — all exit 0.

---

## E2E

Thirteen Nest packages with `test:e2e` scripts: all exit 0.

---

## Gaps (documented, not regressions)

- Soft-skipped journey smokes when auth/DB/mesh down  
- nft/staking/connections/bridge lack dedicated Nest e2e packages (covered by unit/integration)  
- Pen-test / funded chain flows outside automated suite  

No failing tests required logic changes in this audit.
