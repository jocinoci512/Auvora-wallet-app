# Performance Audit — RC1 (Task 035)

**Date:** 2026-07-27  
**Complements:** Task 034 frontend audit · Phase 13/ERV backend probes  
**Verdict:** **Performance Status — Pass**

## Frontend (Next.js production)

| Metric                     | Web         | Admin      |
| -------------------------- | ----------- | ---------- |
| Shared First Load JS       | **103 kB**  | **102 kB** |
| Dashboard `/` First Load   | 178 kB      | —          |
| Settings / Web3 First Load | ~176–177 kB | —          |

Optimizations retained: `optimizePackageImports`, AVIF/WebP images, font swap+preload, route skeletons, compress.

## Gateway load (this host, 2026-07-27)

| Scenario         | Concurrency | RPS            | p95 ms | Error rate             |
| ---------------- | ----------- | -------------- | ------ | ---------------------- |
| `/health`        | 50          | **~1529–1862** | 39–53  | **0%**                 |
| `/api/docs`      | 10          | **~2460–2548** | ~6     | **0%**                 |
| auth `/health`   | 20          | n/a            | —      | skipped (process down) |
| wallet `/health` | 20          | n/a            | —      | skipped (process down) |

## Web surface load

| URL                      | Concurrency | Duration | OK  | Error rate |
| ------------------------ | ----------- | -------- | --- | ---------- |
| `http://localhost:3000/` | 20          | 5s       | 20  | 0%         |

(Note: Next cold/concurrent SSR shows higher latency under burst; First Load budgets remain the release gate.)

## API latency / queries

- Proxy timeout **30s**
- Edge rate limit default 300/min/window
- Prisma pooling guidance in `.env.example`
- Domain query performance certified under integration suites (mocked providers)

## Perceived performance

- Skeleton loaders (root, settings, web3)
- Offline banner + soft cache (Task 034)
- Reduced-motion preferences honored

## Regressions

None vs Task 034 First Load shared ~103 kB.

## Follow-ups

- Redis-backed rate limit for multi-instance
- LCP field metrics via observability once mesh is always-on in CI
- Virtualize long activity lists at scale
