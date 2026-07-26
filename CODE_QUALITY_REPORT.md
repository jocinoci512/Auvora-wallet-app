# Code Quality Report

**Audit date:** 2026-07-26 (post–RC refresh)  
**Scope:** Full monorepo (apps, services, packages, infrastructure docs, CI)  
**Baseline:** Prior audit + Phase 14 **v1.0.0-rc.1**  
**Goal:** Maintainability and internal consistency — not new features.

## Executive summary

Architecture boundaries remain clean (apps → `@auvora/sdk` only; no circular package deps). RC closed prior **Critical** fail-open address validation and unauthenticated resilience metrics. This pass focused on **remaining OpenAPI/SDK contract drift** (AI knowledge, analytics paths, custody phantoms), **unused `@nestjs/terminus`**, docs port clash, and report freshness. Largest open maintainability risks are still Nest infrastructure copy-paste, unused resilient-proxy wiring, AI vector full-scan, and unbounded/N+1 DB reads.

## Verification after safe fixes

| Check | Result |
|-------|--------|
| `pnpm lint` | **PASS** (29/29) |
| `pnpm test` | **PASS** (29/29) |
| `pnpm build` | **PASS** (23/23) |
| External Nest APIs | Unchanged — SDK/OpenAPI aligned **to** Nest |

## Findings by priority

### Critical

| ID | Finding | Status |
|----|---------|--------|
| C1 | Wallet address validation fail-open when blockchain URL unset | **Resolved (RC)** — local format validation, fail-closed |
| — | No new Critical findings this pass | — |

### High

| ID | Finding | Location | Status |
|----|---------|----------|--------|
| H1 | Custody/auth OpenAPI path drift | gateway swagger | **Fixed** (prior) |
| H2–H3 | SDK / wallet fetch timeouts | sdk, wallet adapter | **Fixed** (prior) |
| H4 | Resilient proxy factory unused | `resilient-proxy.ts` | **Open** — wiring changes failure modes |
| H5 | Nest health/guards/publishers cloned ×6–9 | `services/*` | **Open** — extract shared package |
| H6 | AI vector search ≤5k rows + JS cosine | `vector-search.service.ts` | **Open** |
| H7 | Observability alert evaluation N+1 | `alerting.service.ts` | **Open** |
| H8 | Client waterfalls / missing `loading.tsx` | apps web/admin | **Partial** |
| H9 | a11y smoke ≠ full a11y | `a11y-smoke.mjs` | **Open** |
| H10 | Next header drift vs gateway | next configs | **Fixed** (prior) |
| H11 | SDK AI knowledge search used GET; Nest is POST | `packages/sdk`, OpenAPI | **Fixed** this pass |
| H12 | SDK admin AI knowledge path missing `/sources` | `packages/sdk` | **Fixed** this pass |
| H13 | Analytics OpenAPI/SDK phantoms (`insights` admin, `aggregation/*`, GET metric/forecast by code) | swagger + sdk | **Fixed** this pass — aligned to Nest |

### Medium

| ID | Finding | Status |
|----|---------|--------|
| M1 | `PROXY_TIMEOUT_MS` unused | **Fixed** (prior) |
| M2 | Unused docs `@auvora/sdk` | **Fixed** (prior) |
| M3 | Admin Users nav stub | **Fixed** (prior) |
| M4 | Stale README / dependency graph | **Fixed** (prior) |
| M5 | `@auvora/cache` / `@auvora/secrets` unconsumed | **Open** — incubating |
| M6 | Unbounded `findMany` | **Open** |
| M7 | DB pool helper under-applied | **Open** |
| M8 | `/metrics/resilience` unauthenticated | **Resolved (RC)** — key required when configured / production |
| M9 | CI `pnpm audit \|\| true` | **Open** |
| M10 | JWT in `localStorage` without ADR | **Open** |
| M11 | Unused `@nestjs/terminus` in all Nest services | **Fixed** this pass — removed |
| M12 | Docs app port collided with wallet `:3002` | **Fixed** — docs → **3011** |
| M13 | Custody OpenAPI phantoms (`verify`, `recovery/requests`) | **Fixed** this pass |

### Low

| ID | Finding | Status |
|----|---------|--------|
| L1 | `presentation/http` vs `controllers` naming | Open |
| L2 | Nested package versions `0.1.0` vs root `1.0.0-rc.1` | Open — GA hygiene |
| L3 | App Jest with zero tests | Open |
| L4 | Scaffold one-shot scripts | Open — archive |
| L5 | Gateway `applyDatabasePoolEnv` without Prisma | Open |
| L6 | Unused `Result` helpers outside tests | Open |
| L7 | ADR ERV text contradicted Phase 14 | **Fixed** this pass |

## Safe fixes applied this pass

1. SDK: AI knowledge search → `POST` with `{ query }`; admin knowledge list → `/knowledge/sources`  
2. SDK: analytics insights → `/api/v1/analytics/insights`; aggregate → `/aggregate/run`; metric/forecast get via list+find; aggregation jobs stub empty  
3. OpenAPI: AI search POST; custody recovery paths; analytics Nest-aligned surfaces  
4. Removed unused `@nestjs/terminus` from 11 services  
5. Docs app port **3011**; ADR ERV wording; refreshed this report + debt + checklist  

## Architecture boundary check

| Check | Result |
|-------|--------|
| Apps → service deep imports | None |
| Packages → apps | None |
| Circular package deps | None |
| Gateway denies `/api/v1/internal/**` | Retained |

## Public API / contract consistency

| Contract | Assessment |
|----------|------------|
| AI knowledge search | Nest POST ↔ SDK/OpenAPI aligned (this pass) |
| Admin AI knowledge | Nest `/knowledge/sources` ↔ SDK aligned |
| Analytics admin | Phantom paths removed; Nest routes documented |
| Custody user recovery | OpenAPI matches Nest `recovery` / `recovery/start` / contacts |
| Resilience metrics | Auth via `x-internal-api-key` when required |

## Recommendations (next iterations)

1. Wire gateway proxies to `createDownstreamProxyMiddleware` (TD-H1).  
2. Extract `@auvora/nest-common` (TD-H2).  
3. PGVector for AI search (TD-H3).  
4. Default `take` on unbounded lists (TD-M3).  
5. ADR for frontend token storage (TD-M4).  
6. OpenAPI/SDK codegen to prevent drift (TD-H7).
