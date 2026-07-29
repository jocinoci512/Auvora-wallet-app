# Chaos Testing Results

Last run: **2026-07-26T20:05:49Z** (Enterprise Readiness Verification)

## Harness

```bash
pnpm perf:chaos
pnpm perf:resilience
```

## Chaos suite (`perf:chaos`)

| Scenario                      | Result   | Notes                                          |
| ----------------------------- | -------- | ---------------------------------------------- |
| health_liveness               | **PASS** | 200 / status ok                                |
| ready_degraded_allowed        | **PASS** | 200; auth check present                        |
| invalid_upstream_path_handled | **PASS** | 404                                            |
| rate_limit_headers_or_429     | **PASS** | Health intentionally skipped from edge limiter |
| swagger_available             | **PASS** | 200                                            |
| resilience_metrics_endpoint   | **PASS** | 200 after Phase 13 gateway restart             |

**Suite: 6/6 checks passed**

## Resilience simulation (`perf:resilience`)

| Scenario                           | Result                            |
| ---------------------------------- | --------------------------------- |
| timeout_policy                     | **PASS**                          |
| retry_with_backoff                 | **PASS** (3 attempts / 2 retries) |
| circuit_breaker_opens_and_fallback | **PASS** (open + fallback)        |
| bulkhead_isolation                 | **PASS**                          |
| composed_resilient_call            | **PASS** (timeout → fallback)     |

**Suite: 5/5 checks passed**

## Failure-mode mapping

| Failure                   | Observed / designed behavior                                          |
| ------------------------- | --------------------------------------------------------------------- |
| Auth outage               | Readiness degraded or structured errors; platform remains responsive  |
| Auth DB down              | Auth `/ready` → `database: unhealthy`; login skipped by journey smoke |
| Unknown routes            | 404 — not 500 storms                                                  |
| Rate limit                | Edge limiter active on API paths; probes excluded                     |
| Upstream hang             | 30s proxy timeouts → 504                                              |
| Library failure injection | Circuit opens, retries bound, fallbacks served                        |

Restart gateway after deploy to activate `/metrics/resilience` and edge rate-limit middleware.
