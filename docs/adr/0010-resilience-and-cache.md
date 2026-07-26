# ADR 0010: Shared Resilience & Cache Libraries

## Status

Accepted — 2026-07-26

## Context

Phase 12 delivered deployable infrastructure. Services had ad-hoc timeouts and one AI Redis cache, but no shared circuit breakers, bulkheads, cache metrics, or gateway edge rate limits.

## Decision

1. Add `@auvora/resilience` for timeout, retry/backoff, circuit breaker, bulkhead, and composable `resilientCall` with measurable counters.
2. Add `@auvora/cache` for store-agnostic read-through / write-through caching, TTL policy constants, invalidation, and hot-key tracking.
3. Harden gateway with edge rate limiting, proxy timeouts, richer security headers, DB pool URL defaults, and `/metrics/resilience`.
4. Provide Node load/chaos/a11y scripts under `scripts/perf/` without requiring k6.
5. Do not rewrite domain services; adopt libraries incrementally.

## Consequences

- Optimizations are testable and metric-backed.
- Existing queue backoff and AI Redis cache remain; TTL defaults align to platform policy.
- Final release activities remain out of scope for Phase 13.
