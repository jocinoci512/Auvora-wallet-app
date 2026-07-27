# Code Health Report

**Date:** 2026-07-26  
**Scope:** Whole-repo health after Phase 17 Alchemy integration  
**Method:** Automated gates + structural infra scan + prod audit + Prisma validate

## Overall repository health score

### **88 / 100**

| Band | Meaning |
|------|---------|
| 90–100 | Excellent — gates green, infra tooling available, audit clean |
| **80–89** | **Strong — gates green; tooling/audit residual risk** ← current |
| 70–79 | Acceptable with known debt |
| &lt; 70 | Blocked or unstable |

### Score breakdown

| Factor | Points | Max | Notes |
|--------|--------|-----|-------|
| Lint clean | 12 | 12 | 29/29 |
| Unit/integration tests | 15 | 15 | 29/29 packages; ~527 tests |
| Production build | 12 | 12 | 23/23 |
| TypeScript typecheck | 10 | 10 | 29/29 |
| Prisma schema validity | 5 | 5 | `prisma validate` OK |
| Install / lockfile integrity | 8 | 8 | Frozen lockfile install OK after env fix |
| Security audit (prod) | 4 | 8 | 0 critical; 5 high / 2 moderate OTEL (accepted) |
| Docker / K8s executable validation | 3 | 8 | Files present; Docker/kubectl CLI absent |
| Runtime stack availability | 4 | 6 | Web/gateway previously up; DB down for blockchain boot |
| Dead code / unused / circulars (via lint+build) | 5 | 6 | ESLint+TS gates; no dedicated madge run |
| **Total** | **88** | **100** | |

## Checklist results

| Area | Status | Evidence |
|------|--------|----------|
| TypeScript errors | **Clean** | `pnpm typecheck` 29/29; Nest/Next builds |
| ESLint issues | **Clean** | `pnpm lint` 29/29 |
| Build failures | **None** | `pnpm build` 23/23 |
| Runtime errors (compile-time / test) | **None observed** | Test suite green |
| Circular dependencies | **No build-time cycles** | Turbo/build graph resolves; Nest modules compile |
| Broken imports | **None** | Typecheck + build |
| Unused imports / variables | **None flagged** | ESLint pass |
| Dead code | **No gate failures** | Lint/TS; no unused-export sweep tool in CI |
| Dependency conflicts | **None** | Frozen lockfile install OK |
| Database migrations / Prisma | **Schema valid** | `prisma validate` OK; no migrate apply in this pass |
| API contract mismatches | **No compile/test breaks** | SDK + service builds/tests green |
| Frontend compilation | **Pass** | web, admin, docs |
| Backend compilation | **Pass** | All Nest services |
| Security warnings | **Accepted residual** | OTEL-related highs in `pnpm audit --prod` |
| Performance regressions | **None detected** | No perf suite regression in this pass; builds succeed |
| Failing unit tests | **None** | All packages PASS |
| Failing integration tests | **None** | Blockchain Alchemy mocks PASS |
| Broken routes / links / UI regressions | **No build-time evidence** | Next static generation completed for web/admin |

## Architecture health notes (Phase 17)

- Wallet / apps still have **zero** Alchemy imports — correct isolation.
- Live providers override simulator entries only when `ALCHEMY_*` env resolves.
- Provider health endpoints are additive; public APIs not broken.

## Remaining issues (non-blocking)

1. Install `NODE_ENV=production` skips `devDependencies` — operators must not set production env for `pnpm install`.
2. `docker compose build` / `kubectl kustomize` need CLI tooling on the host.
3. Prod audit OTEL advisories remain until a dedicated upgrade.
4. Live Alchemy RPC health needs Postgres + Redis + configured `ALCHEMY_*`.
5. Simulator-ledger check on withdrawals vs live Alchemy balances (documented Phase 17 known issue).

## Recommendation

Repository is **clean for quality gates**. Safe to proceed to the next planned phase once operators restore local Postgres/Redis (and optional Alchemy keys) for runtime verification. Do not treat OTEL audit items or Docker CLI absence as code defects in this tree.
