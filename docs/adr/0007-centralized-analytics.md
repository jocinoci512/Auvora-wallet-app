# ADR 0007: Centralized Analytics & BI Platform

## Status

Accepted — 2026-07-26

## Context

Operational, financial, compliance, and product metrics were at risk of being computed independently inside each module. That would duplicate logic, prevent a single executive view, and break auditability of reports.

## Decision

1. **All analytics events flow through `@auvora/analytics-service` (port 3007).** Domain services publish via fire-and-forget internal HTTP; Web/Admin use the gateway.
2. **Metrics, KPIs, dashboards, and reports are data-driven** — definitions live in Postgres; no hardcoded KPI business rules in application code beyond evaluation helpers.
3. **Aggregation is incremental** — events → hourly/daily/monthly `MetricValue` buckets via a worker; jobs are tracked.
4. **Forecasting is pluggable** — `linear_trend` shipped; other algorithms can register later.
5. **Report payloads are encrypted at rest** with `ANALYTICS_FIELD_ENCRYPTION_KEY`.
6. **Additive contracts only** — optional `ANALYTICS_SERVICE_URL` on producers and gateway.

## Consequences

- Modules never generate authoritative reports locally.
- Adding a KPI is a seed/admin row, not a deploy of business logic.
- In-service aggregation is sufficient for MVP; a warehouse can replace the aggregation worker later without changing public APIs.

## Governance addendum (2026-07-26)

1. **Ingest contract:** producers must supply `domain`; optional `metrics` map keys must match `MetricDefinition.code`.
2. **Scheduled reliability:** failed runs retry with exponential backoff (`nextAttemptAt`) until `maxAttempts`, then `FAILED`.
3. **Performance SLIs** (`dashboard_load_ms`, `report_generate_ms`, `aggregation_duration_ms`) are first-class metrics exposed via admin performance summary.
4. **RBAC:** SHARED dashboards are owner/admin only; KPI/metric/report management uses `analytics:*` permission codes.
5. Evidence: `docs/PRODUCTION_READINESS_ANALYTICS.md`, `docs/diagrams/analytics-data-flow.md`.
