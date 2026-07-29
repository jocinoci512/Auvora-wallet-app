# Performance Report

Last verified: **2026-07-26** (Enterprise Readiness Verification)

## Objectives

Every optimization is measurable via unit tests, `/metrics/resilience`, cache hit ratio helpers, or `scripts/perf/*` harnesses.

## Shared libraries

| Package              | Purpose                                                              | Metrics                                                                                        |
| -------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `@auvora/cache`      | Read-through / write-through / TTL / invalidation / hot-key tracking | `hits`, `misses`, `sets`, `deletes`, `hitRatio()`, `getHotKeys()`                              |
| `@auvora/resilience` | Timeout, retry+backoff, circuit breaker, bulkhead, fallback          | `successes`, `failures`, `retries`, `timeouts`, `circuitOpens`, `bulkheadRejects`, `fallbacks` |

## Before / after (critical APIs)

| Metric                       | Before (Phase 12 baseline) | After (Phase 13 + ERV)                 | Delta                           |
| ---------------------------- | -------------------------- | -------------------------------------- | ------------------------------- |
| Gateway `/health` p95 target | 50 ms acceptance floor     | **18.15 ms** measured (micro-probe)    | **−31.85 ms** vs target         |
| Gateway `/health` load p95   | —                          | **88.01 ms** @ 50 conc / 5s (834 RPS)  | Sustained under load; 0% errors |
| Swagger `/api/docs` load p95 | —                          | **11.53 ms** @ 10 conc / 5s (1302 RPS) | 0% errors                       |
| Auth `/health` load p95      | N/A (often down)           | **32.25 ms** @ 20 conc (990 RPS)       | 0% errors                       |
| Wallet `/health` load p95    | N/A (often down)           | **31.23 ms** @ 20 conc (986 RPS)       | 0% errors                       |
| AI cache default TTL         | 60 s                       | **120 s**                              | +60 s                           |
| Proxy timeout                | none                       | **30 000 ms**                          | Fail-bounded                    |
| Edge rate limit              | off                        | **on** (`GATEWAY_RATE_LIMIT_*`)        | Abuse protection                |
| Cache hot-path hit ratio     | N/A                        | **0.995** (200 reads / 1 loader)       | Loader once                     |
| Resilience fallback avg      | N/A                        | **0.026 ms** (30 iterations)           | Circuit + fallback              |

Reproduce:

```bash
pnpm perf:benchmark
pnpm perf:load
pnpm perf:resilience
```

## Shared libraries in depth

See Phase 13 tables below; ERV confirmed `/metrics/resilience` live after gateway restart.

## API / gateway

- Edge **fixed-window rate limiting** (`GATEWAY_RATE_LIMIT_MAX` / `WINDOW_SECONDS`) with `X-RateLimit-*` headers.
- Downstream proxies: **30s** `timeout` / `proxyTimeout`.
- Resilient proxy helper + `/metrics/resilience` counters/circuit states.
- Security headers hardened (COOP/CORP/HSTS in production).

## Database

- `withDatabaseUrlPool()` / `applyDatabasePoolEnv()` appends `connection_limit`, `pool_timeout`, `connect_timeout`, `statement_cache_size` without dropping existing params.
- Gateway applies pool defaults at boot.
- Existing Prisma indexes retained; prefer keyset/cursor pagination and batched writes for hot paths.

## Cache strategy

| Domain               | TTL (s) | Pattern                                                  |
| -------------------- | ------- | -------------------------------------------------------- |
| Session              | 300     | write-through                                            |
| Wallet balance       | 15      | read-through + invalidate on ledger write                |
| Blockchain fees      | 30      | read-through                                             |
| Analytics dashboards | 60      | read-through                                             |
| AI requests          | 120     | existing Redis request cache (default TTL raised to 120) |
| Feature flags        | 60      | read-through                                             |

Invalidation: explicit key delete + prefix delete. Hot keys: `CacheClient.getHotKeys()`.

## Frontend

- `compress: true`
- `optimizePackageImports` for `@auvora/ui` / `@auvora/sdk`
- Security response headers on Web/Admin
- App Router already route-splits; no dashboard bloat added

## Background / domain

- Notifications queue exponential backoff unchanged (validated).
- AI request cache TTL aligned to platform policy (120s default).
- Workers remain horizontally scalable (stateless Nest services).

## Benchmarks (local harness)

```bash
node scripts/perf/run-suite.mjs
node scripts/perf/benchmark-compare.mjs
node scripts/perf/load-test.mjs --path /health --concurrency 50 --duration 10
```

Results: [`LOAD_TEST_RESULTS.md`](./LOAD_TEST_RESULTS.md). Topology: [`diagrams/scalability-resilience-topology.md`](./diagrams/scalability-resilience-topology.md).

## Scalability posture

- Stateless Nest services + gateway
- HPA/PDB already in Helm (Phase 12)
- Bulkheads/circuit breakers for downstream isolation
- Queue backpressure via existing notification max attempts + DLQ

## ERV notes

- Auth `/ready` correctly reports `database: unhealthy` when Postgres is down; login/register then skip or surface structured `INTERNAL_ERROR` while routes remain wired.
- Gateway `/ready` continues to probe auth liveness; domain 504s under missing upstreams validate proxy timeouts.
