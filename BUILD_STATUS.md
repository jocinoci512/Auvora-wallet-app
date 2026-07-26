# Build Status

Last verified: **2026-07-26** (Analytics Governance & Data Quality)

## Summary

| Check | Result |
|-------|--------|
| Workspace `pnpm build` | **PASS** (19/19) |
| Workspace `pnpm lint` | **PASS** (24/24) |
| Workspace `pnpm test` | **PASS** (24/24) |
| Prisma migrate `20260726120000_analytics_platform` | APPLIED |
| Prisma migrate `20260726130000_analytics_scheduled_retry` | APPLIED |
| Seed version | **1.0.0** |
| Governance checklist | [`docs/PRODUCTION_READINESS_ANALYTICS.md`](docs/PRODUCTION_READINESS_ANALYTICS.md) |
| Data flow diagram | [`docs/diagrams/analytics-data-flow.md`](docs/diagrams/analytics-data-flow.md) |

### Test counts (selected)

| Package | Suites | Tests |
|---------|--------|-------|
| `@auvora/analytics-service` | 21 | **89** |
| `@auvora/ai-service` | 11 | 90 |
| `@auvora/blockchain-service` | 6 | 31 |
| `@auvora/custody-service` | 7 | 51 |
| `@auvora/wallet-service` | 3 | 14 |

## Phase status

| Phase | Scope | Status |
|-------|--------|--------|
| 1–9 | Foundation → AI | Complete |
| 10 | **Analytics / BI** | **Complete** + governance verified |
| 11+ | Infrastructure / SRE | Not started |

## Phase 10 deliverables

- `@auvora/analytics-service` on port **3007**
- Event ingest + aggregation worker (hourly/daily/monthly)
- Configurable metrics & KPIs (definitions in DB; admin create/update)
- System dashboards (executive, ops, finance, compliance, security, AI, infrastructure)
- Reports (JSON/CSV/XLSX/PDF stubs) with encrypted storage; scheduled reports **with retry/backoff**
- Performance SLIs: `dashboard_load_ms`, `report_generate_ms`, `aggregation_duration_ms` via `/admin/analytics/performance`
- Linear-trend forecasting framework
- Gateway proxy; SDK; Web `/analytics`; Admin analytics portals
- Publishers on auth/wallet/payments/compliance/custody/blockchain/notifications/AI (`domain` + optional `metrics`)
- Permissions `analytics:read|write|admin|reports|dashboards|kpis`; SHARED dashboards owner/admin only

## Local env note

Ensure `.env` includes `ANALYTICS_SERVICE_URL`, `ANALYTICS_FIELD_ENCRYPTION_KEY` (≥32 chars).
