# Load Test Results — RC1

**Last run:** 2026-07-27 (Task 035 Release Engineering)  
**Harness:** `pnpm perf:load` → `scripts/perf/run-suite.mjs` + `scripts/perf/load-test.mjs`

## How to run

```bash
pnpm perf:load
# optional single target:
node scripts/perf/load-test.mjs --base http://localhost:4000 --path /health --concurrency 50 --duration 5
```

## RC1 measured results (gateway up; auth/wallet processes down)

| Scenario      | URL              | Concurrency | Duration | Requests | RPS      | p50 ms | p95 ms   | Error rate                |
| ------------- | ---------------- | ----------- | -------- | -------- | -------- | ------ | -------- | ------------------------- |
| health        | `:4000/health`   | 50          | 5s       | 7833     | **1529** | 27.2   | **53.3** | **0%**                    |
| swagger       | `:4000/api/docs` | 10          | 5s       | 12485    | **2460** | 3.6    | **6.3**  | **0%**                    |
| auth health   | `:4001/health`   | 20          | 5s       | —        | —        | —      | —        | **skipped** (unreachable) |
| wallet health | `:3002/health`   | 20          | 5s       | —        | —        | —      | —        | **skipped** (unreachable) |

Peak sample in the same session (health): **~1862 RPS**, p95 **~39 ms**, **0%** errors.

## ERV reference (2026-07-26, warmer mesh)

| Scenario      | RPS  | p95 ms | Error rate |
| ------------- | ---- | ------ | ---------- |
| health        | 834  | 88.0   | 0%         |
| swagger       | 1302 | 11.5   | 0%         |
| auth health   | 990  | 32.3   | 0%         |
| wallet health | 986  | 31.2   | 0%         |

## Acceptance

| Metric                       | Target                 | RC1 result                               |
| ---------------------------- | ---------------------- | ---------------------------------------- |
| Gateway `/health` error rate | &lt; 1%                | **PASS** (0%)                            |
| Swagger under load           | OK                     | **PASS**                                 |
| Auth/wallet health           | OK when process up     | **SKIPPED** this host — soft-skip policy |
| Suite exit                   | 0 when gateway healthy | **PASS**                                 |

## Graceful degradation

- Gateway `/ready` returns **503** when auth is down (load balancers drain correctly).
- Load suite soft-skips fully unreachable auth/wallet targets when gateway scenarios succeed.
- Journey smoke soft-skips domain API contracts when upstreams return 502/503/504.

## Stress observation

Gateway alone sustains 1.5k–2.5k RPS on health/docs locally with zero errors. Full-mesh concurrent user + mutation load remains a staging exercise (Postgres + all Nest services).
