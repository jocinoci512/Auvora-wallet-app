# 02 — Observability

## Architecture

Central **observability** service (ADR 0008) aggregates metrics, traces, masked logs, health, alerts, incidents, SLOs, capacity, dependencies, and maintenance notices. Admin SDK methods already covered most reads; Phase 8 closed UI gaps.

## Surfaces

| Concern                   | Admin route                  | API                            |
| ------------------------- | ---------------------------- | ------------------------------ |
| Ops dashboard             | `/observability`             | `adminObservabilityDashboard`  |
| Alerts / incidents / SLOs | `/observability/*`           | existing list endpoints        |
| Service health            | `/observability/health`      | structured (no JSON dump)      |
| Logs                      | `/observability/logs`        | `adminSearchObservabilityLogs` |
| Maintenance               | `/observability/maintenance` | list + create                  |
| Public status             | `apps/web` `/status`         | platform status + notices      |
| Per-service liveness      | `services/*/health`          | gateway `/health`, `/ready`    |

## Improvements

1. **Logs page** — previously linked but missing.
2. **Maintenance CRUD UI** — publish notices used by status page / ops overview.
3. **Health page** — badges and service list instead of `<pre>` JSON.
4. **Overview strip** — home page composes open alerts/incidents/unhealthy services.

## External monitoring

Operator-side Prometheus/Alertmanager wiring remains documented in `docs/MONITORING_GUIDE.md` and `infrastructure/monitoring/`. Phase 8 does not replace that stack.

## Honest limits

- Log/trace retention and PII masking are service-enforced; UI does not invent fields.
- Incident ack/assign actions exist server-side in places; not all are exposed as buttons yet.
- Capacity/SLO pages remain thinner list UIs — charts deferred.
