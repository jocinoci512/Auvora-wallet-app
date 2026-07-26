# Load Test Results

Last run: **2026-07-26T20:06:10Z** (Enterprise Readiness Verification)

## Harness

```bash
pnpm perf:load
# or
node scripts/perf/run-suite.mjs
pnpm perf:benchmark
```

## Measured results (ERV)

| Scenario | URL | Concurrency | Duration | Requests | RPS | p50 ms | p95 ms | Error rate |
|----------|-----|-------------|----------|----------|-----|--------|--------|------------|
| health | `:4000/health` | 50 | 5s | 4304 | **834** | 54.1 | **88.0** | **0%** |
| swagger | `:4000/api/docs` | 10 | 5s | 6644 | **1302** | 7.3 | **11.5** | **0%** |
| auth health | `:4001/health` | 20 | 5s | 5092 | **990** | 17.8 | **32.3** | **0%** |
| wallet health | `:3002/health` | 20 | 5s | 5059 | **986** | 18.2 | **31.2** | **0%** |

## Prior Phase 13 peak (reference)

| Scenario | RPS | p95 ms | Error rate |
|----------|-----|--------|------------|
| health | 1720 | 36.6 | 0% |
| swagger | 2565 | 6.3 | 0% |

Phase 13 peak was measured on a long-lived warm gateway; ERV re-run after restart still meets **0% errors**. Absolute RPS varies with host load; acceptance remains error rate &lt; 1% and functional availability.

## Before / after (from `perf:benchmark`)

| Signal | Before | After |
|--------|--------|-------|
| Health p95 vs 50 ms floor | 50 ms target | **18.15 ms** micro-probe |
| AI cache TTL | 60 s | **120 s** |
| Proxy timeout | none | **30 s** |
| Edge rate limit | false | **true** |
| Cache hit ratio (hot) | n/a | **0.995** |
| `/metrics/resilience` | absent | **200 OK** |

## Stress observation

Gateway and domain health endpoints sustain hundreds–thousands of RPS locally with zero errors. Domain mutation journeys require Postgres; when DB is down, auth `/ready` reports `database: unhealthy` and login is skipped by journey smoke (see `scripts/perf/journey-smoke.mjs`).

## Acceptance targets

| Metric | Target | Result |
|--------|--------|--------|
| `/health` error rate | &lt; 1% | **PASS** (0%) |
| Swagger under load | OK | **PASS** |
| Auth/wallet health under load | OK when process up | **PASS** |
| Resilience metrics endpoint | Available | **PASS** |
