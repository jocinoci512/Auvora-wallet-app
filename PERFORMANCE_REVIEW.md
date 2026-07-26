# Performance Review

**Audit date:** 2026-07-26  
**Phase:** 15 — Enterprise Repository Audit  
**Baseline metrics:** [`docs/PERFORMANCE_REPORT.md`](docs/PERFORMANCE_REPORT.md)

## Score: **7.6 / 10**

Gateway health/load numbers and resilience harnesses are solid. Platform-level risk is concentrated in AI vector full-scan, observability alert N+1, unbounded list queries, and unused resilient-proxy / cache adoption.

## Strengths

- Edge rate limiting and 30s proxy timeouts.  
- `@auvora/resilience` metrics endpoint (auth-gated).  
- Perf harnesses: load, chaos, resilience sim, journey, a11y smoke, benchmark compare.  
- Next `compress` + `optimizePackageImports`.  
- Prisma schema well-indexed for core money/auth paths.

## Findings

### Critical

None.

### High

| ID | Finding | Location |
|----|---------|----------|
| P-H1 | AI knowledge search loads up to **5 000** embeddings and scores cosine in-process | `services/ai/.../vector-search.service.ts` |
| P-H2 | Alert evaluation N+1 (per-rule metric + samples) | `services/observability/.../alerting.service.ts` |
| P-H3 | Resilient proxy not on live middleware path — metrics under-report real circuits | gateway proxies |

### Medium

| ID | Finding |
|----|---------|
| P-M1 | Multiple unbounded `findMany` (infra lists, alert rules, dependencies, etc.) |
| P-M2 | DB pool helper under-applied (gateway only) |
| P-M3 | `@auvora/cache` not adopted on hot Nest paths |
| P-M4 | No App Router `loading.tsx` in web/admin (perceived latency) |

### Low

| ID | Finding |
|----|---------|
| P-L1 | Staging load test still outstanding for GA |
| P-L2 | Cache TTL policy documented but not enforced via shared client in services |

## Measured RC baselines (unchanged)

| Metric | Result |
|--------|--------|
| Gateway `/health` micro p95 | ~18 ms |
| Gateway `/health` load p95 @ 50c | ~88 ms, 0% errors |
| Resilience sim | 5/5 pass |

## Recommendations

1. PGVector / ANN for AI search (TD-H3).  
2. Batch alert evaluation queries (TD-H4).  
3. Default `take` caps on admin list endpoints (TD-M3).  
4. Feature-flag resilient proxy rollout (TD-H1).  
5. Staging soak + load certification before GA.
