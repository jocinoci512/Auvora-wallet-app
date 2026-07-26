# Technical Debt Report

**Last updated:** 2026-07-26 (Code Quality Audit — post–RC refresh)  
**Companion:** [`CODE_QUALITY_REPORT.md`](CODE_QUALITY_REPORT.md), [`FINAL_RELEASE_CHECKLIST.md`](FINAL_RELEASE_CHECKLIST.md)

## Release-blocking candidates

| ID | Debt | Status |
|----|------|--------|
| RB1 | Wallet fail-open address validation | **Resolved in v1.0.0-rc.1** |
| RB2 | OpenTelemetry high CVEs | **Accepted for RC** — coordinated upgrade post-RC |
| RB3 | Unauthenticated `/metrics/resilience` | **Resolved in v1.0.0-rc.1** |

## High priority debt

| ID | Area | Description | Effort |
|----|------|-------------|--------|
| TD-H1 | Gateway | Wire `createDownstreamProxyMiddleware` so metrics reflect real circuits | M |
| TD-H2 | Platform | Extract shared Nest common (health, guards, CSRF, publishers, interceptors) | L |
| TD-H3 | AI | Replace 5k-row embedding scan + JS cosine with PGVector / ANN | L |
| TD-H4 | Observability | Batch alert evaluation queries (eliminate N+1) | M |
| TD-H5 | Frontend | App Router `loading.tsx` + consistent loading/empty/error | M |
| TD-H6 | A11y | Expand beyond smoke (axe/Playwright) | M |
| TD-H7 | Contracts | Generate SDK + OpenAPI from Nest (prevent drift) | L |

## Medium priority debt

| ID | Area | Description | Effort |
|----|------|-------------|--------|
| TD-M1 | Cache/Secrets | Adopt or formally mark incubating-only | M |
| TD-M2 | Database | Apply `applyDatabasePoolEnv` to DB-heavy services | S |
| TD-M3 | Lists | Default `take` caps on unbounded `findMany` | M |
| TD-M4 | Auth UX | ADR or migrate JWT out of `localStorage` | M |
| TD-M5 | CI | Allowlisted `pnpm audit` that fails on new highs | S |
| TD-M6 | Versions | Align nested package versions to `1.0.0-rc.1` / GA tag | S |
| TD-M7 | Field encryption | Consolidate 6× adapters into shared package | M |
| TD-M8 | Permissions | Auth seed vs full `PermissionCode` union drift | S |
| TD-M9 | Analytics | Aggregation job list / metric detail endpoints (SDK stubs today) | M |

## Low priority debt

| ID | Area | Description | Effort |
|----|------|-------------|--------|
| TD-L1 | Apps | Remove empty Jest scaffolding or add UI tests | S |
| TD-L2 | Scripts | Archive `generate-*.mjs` / `scaffold-*.mjs` | S |
| TD-L3 | Types | Remove or use `Result` helpers | S |
| TD-L4 | Presentation | Unify `http` vs `controllers` folders | S |
| TD-L5 | Ports | Document `4xxx` vs `3xxx` port bands | S |
| TD-L6 | Docs | Cross-link overlapping infra diagrams | S |

## Accepted risks

| Risk | Mitigation |
|------|------------|
| OTEL highs | Health/ready independent of exporter; upgrade train post-RC |
| brace-expansion advisory range FP on 1.1.16 | Major-scoped overrides; never global-pin 5.x onto ESLint |

## Paid-down this audit refresh

- AI / analytics / custody OpenAPI + SDK contract alignment  
- Unused `@nestjs/terminus` removed from Nest services  
- Docs port moved off wallet `:3002` → `:3011`  
- CODE_QUALITY_REPORT stale C1/M8 statuses corrected  
- ADR ERV vs Phase 14 wording fixed  

## Tracking guidance

- Prefer ADRs for security posture changes.  
- Prefer shared packages over a third copy of Nest adapters.  
- Do not bump OTEL piecemeal per service.  
- Prefer OpenAPI/SDK codegen before more hand-maintained path tables.
