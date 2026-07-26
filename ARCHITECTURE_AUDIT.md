# Architecture Audit

**Audit date:** 2026-07-26  
**Phase:** 15 — Enterprise Repository Audit  
**Scope:** `apps/`, `services/`, `packages/`, `database/`, `infrastructure/`, `scripts/`, `docs/`, `.github/`

## Score: **8.4 / 10**

Hexagonal Nest services with clear domain / application / infrastructure / presentation layers; apps consume `@auvora/sdk` only. No redesign required for GA — remaining debt is duplication and incomplete adoption of shared packages.

## Verified strengths

| Concern | Evidence |
|---------|----------|
| Hexagonal / DDD | Services use `domain/`, `application/`, `infrastructure/`, `presentation/` with ports/tokens |
| Dependency injection | Nest modules + `@Inject` ports (`MODEL_ROUTER`, `REDIS_PORT`, etc.) |
| Shared libraries | `@auvora/types`, `database`, `security`, `sdk`, `resilience`, `cache`, `secrets`, `ui`, `config` |
| Module boundaries | Workspace packages; apps do not import Nest service internals |
| API versioning | Gateway proxies under `/api/v1/*` |
| Infra as code | Helm + Terraform modules + Kustomize overlays + CI artifact job |
| Observability platform | Dedicated `services/observability` + publishers in domain services |

## Findings

### Critical

None.

### High

| ID | Finding | Location | Notes |
|----|---------|----------|-------|
| A-H1 | Nest infrastructure cloned across services (health, CSRF, JWT guards, field encryption, observability publishers) | `services/*/src/presentation/guards`, `infrastructure/crypto`, `observability-publisher.adapter.ts` (×9) | Extract `@auvora/nest-common` (TD-H2 / TD-M7) — **not** auto-fixed (structural) |
| A-H2 | Resilient proxy factory unused by downstream proxies | `resilient-proxy.ts` vs `*-proxy.middleware.ts` using raw `createProxyMiddleware` | Wiring changes failure modes — deferred (TD-H1) |

### Medium

| ID | Finding | Location |
|----|---------|----------|
| A-M1 | `@auvora/cache` / `@auvora/secrets` incubating, unused by Nest | packages + services |
| A-M2 | `applyDatabasePoolEnv` only applied in gateway | `services/gateway/src/main.ts` |
| A-M3 | Presentation folder naming drift (`http` vs `controllers`) | observability vs older services |
| A-M4 | Hand-maintained OpenAPI + SDK paths (drift risk) | gateway swagger + `packages/sdk` |

### Low

| ID | Finding |
|----|---------|
| A-L1 | Nested package versions still `0.1.0` vs root `1.0.0-rc.1` |
| A-L2 | Port band documentation (`3xxx` services vs `4xxx` gateway legacy) incomplete |

## Circular dependencies

No package-level circular workspace dependencies detected. Domain layers do not import Nest/Prisma directly in reviewed services (Prisma stays in infrastructure / application via ports).

## CQRS

Not used as a formal pattern. Command/query separation is informal via application services — acceptable for current scale; do not introduce CQRS without a concrete write/read scaling need.

## Recommendations (non-breaking)

1. Extract shared Nest adapters after RC soak (guards, CSRF, publishers, field encryption).  
2. Wire resilient proxy behind feature flag for staged rollout.  
3. Adopt cache/secrets packages or mark incubating in ADRs (READMEs added this audit).  
4. Prefer OpenAPI/SDK codegen before expanding path tables.
