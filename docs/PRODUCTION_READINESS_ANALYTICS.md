# Production Readiness — Analytics Governance & Data Quality

Last verified: **2026-07-26**

See also: [`docs/diagrams/analytics-data-flow.md`](./diagrams/analytics-data-flow.md).

## 1. Centralized event publishing — **PASS**

All eight modules publish via `AnalyticsPublisherAdapter` → `POST /api/v1/internal/analytics/events` with required `domain`, optional `metrics`, and `sourceService`:

| Module        | Event                              | Domain        | Metrics                   |
| ------------- | ---------------------------------- | ------------- | ------------------------- |
| Auth          | `auth.login.completed`             | AUTH          | `dau`                     |
| Wallet        | `wallet.transfer.completed`        | WALLET        | `tx_volume`               |
| Payments      | `payment.completed`                | PAYMENTS      | `tx_volume`               |
| Compliance    | `compliance.kyc.approved`          | COMPLIANCE    | —                         |
| Custody       | `custody.signing.completed`        | CUSTODY       | —                         |
| Blockchain    | `blockchain.transaction.confirmed` | BLOCKCHAIN    | —                         |
| Notifications | `notification.sent`                | NOTIFICATIONS | `notification_sent_count` |
| AI            | `ai.chat.completed`                | AI            | `ai_request_count`        |

## 2. Configurable definitions — **PASS**

Metrics, KPIs, dashboards, report templates, and forecast models are Postgres rows (seed + admin CRUD for metrics/KPIs). Runtime evaluation uses DB definitions; no hardcoded KPI business formulas.

## 3. RBAC — **PASS**

- User: `analytics:read|write|reports|dashboards|kpis`
- Admin: roles + `analytics:admin` (and fine-grained codes)
- SHARED dashboards: owner or admin only
- Internal ingest: API key; not gateway-proxied

## 4. Scheduled reports + retry — **PASS**

`attemptCount` / `maxAttempts` / `lastError` / `nextAttemptAt` with exponential backoff; terminal `FAILED` after limit. Worker polls due runs and retries.

## 5. Performance measurement — **PASS**

Instrumented and reportable via `GET /api/v1/admin/analytics/performance`:

- `dashboard_load_ms`
- `report_generate_ms`
- `aggregation_duration_ms`

## Documentation

- Data flow: `docs/diagrams/analytics-data-flow.md`
- This checklist: `docs/PRODUCTION_READINESS_ANALYTICS.md`
- ADR `0007`, `INTEGRATION_REPORT_PHASE10.md`, `BUILD_STATUS.md`, `CHANGELOG.md`, `ARCHITECTURE_DECISIONS.md`
- Gateway OpenAPI stubs updated for performance + metric CRUD where applicable
