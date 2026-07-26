# ADR 0008: Centralized Observability & SRE Platform

## Status

Accepted — 2026-07-26

## Context

Each Nest service already emitted local OTel traces, pino logs, and `/health` probes. Without a central SRE plane, operators lacked unified alerting, incident workflow, SLO tracking, and cross-service dependency visibility.

## Decision

1. **All operational telemetry is centralized in `@auvora/observability-service` (port 3010).** Producers publish via fire-and-forget internal HTTP (`ObservabilityPublisherAdapter`); Web/Admin use the gateway.
2. **Existing per-service otel/logger/health remain** — the platform aggregates and acts on signals; it does not replace local instrumentation.
3. **Metrics, traces, logs (masked), health, alerts, incidents, SLOs, capacity, and dependencies are data-driven** Postgres models.
4. **Alert evaluation runs in-process** with configurable rules and threshold comparisons; incidents support ack/assign/escalate/resolve + timeline.
5. **Additive contracts only** — optional `OBSERVABILITY_SERVICE_URL`.

## Consequences

- Modules never own authoritative ops dashboards locally.
- Sensitive log fields are masked at ingest.
- A future warehouse/OTLP collector can replace internal ingest without changing public APIs.

## Operational readiness addendum (2026-07-26)

1. **Correlation:** every Nest entrypoint (including gateway/auth/wallet) applies `RequestContextMiddleware`; gateway proxies forward W3C + correlation headers.
2. **Metrics:** `ObservabilityMetricsInterceptor` emits `http_latency_ms` and `error_rate` to the observability ingest API.
3. **Alert ops:** rules are mutable via `PATCH .../alert-rules/:code` (enable/disable/threshold) without deploys.
4. **SLO compliance:** `GET .../slos/compliance` reports platform latency/error/uptime against configured targets.
5. Evidence: `docs/PRODUCTION_READINESS_OBSERVABILITY.md`, `docs/diagrams/runtime-service-dependency-graph.md`.
