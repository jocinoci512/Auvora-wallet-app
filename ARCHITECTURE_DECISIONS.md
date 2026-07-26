# Architecture Decisions

Index of architecture decision records (ADRs) and Phase 6 decisions captured during the Compliance Platform build.

## ADR index

| ID | Title | Status |
|----|-------|--------|
| [0001](docs/adr/0001-modular-monolith.md) | Modular monolith with service boundaries | Accepted |
| [0002](docs/adr/0002-compliance-policy-engine.md) | Compliance as policy enforcement engine over HTTP | Accepted |
| [0003](docs/adr/0003-compliance-provider-ports.md) | Provider-agnostic compliance adapters | Accepted |
| [0004](docs/adr/0004-custody-provider-ports.md) | Multi-model custody via provider ports | Accepted |
| [0005](docs/adr/0005-centralized-notifications.md) | Centralized notification platform | Accepted |
| [0006](docs/adr/0006-centralized-ai-platform.md) | Centralized enterprise AI platform | Accepted |
| [0007](docs/adr/0007-centralized-analytics.md) | Centralized analytics & BI platform | Accepted |

## Phase 10 decision summary

1. **All analytics events go through `@auvora/analytics-service`** — modules publish; they do not author reports.
2. **KPIs/metrics/dashboards are configuration** — no hardcoded KPI business rules in code; admin CRUD for metrics/KPIs.
3. **Aggregation worker** materializes hourly/daily/monthly metric values.
4. **Forecasting is extensible** — `linear_trend` first; algorithms are data-selected.
5. **Report results encrypted at rest**; scheduled reports retry with exponential backoff.
6. **Performance SLIs** recorded as metrics (`dashboard_load_ms`, `report_generate_ms`, `aggregation_duration_ms`).
7. **Additive contracts** — optional `ANALYTICS_SERVICE_URL`; publishers send required `domain`.
8. Evidence: ADR [0007](docs/adr/0007-centralized-analytics.md), [`docs/PRODUCTION_READINESS_ANALYTICS.md`](docs/PRODUCTION_READINESS_ANALYTICS.md), [`docs/diagrams/analytics-data-flow.md`](docs/diagrams/analytics-data-flow.md).

## Phase 9 decision summary

1. **All AI traffic goes through `@auvora/ai-service`** — no app talks to OpenAI/Anthropic/Gemini directly.
2. **Provider ports + model router** — priority selection with failover; simulator default in non-prod.
3. **RAG is first-class** — chunk → embed → cosine search in Postgres for MVP.
4. **Prompts are versioned** — approval, preview, rollback.
5. **Safety + cost are platform concerns** — RBAC, PII hooks, token/cost metrics, audit trail.
6. **Additive contracts** — optional `AI_SERVICE_URL` on gateway.

## Phase 8 decision summary

1. **All outbound communications go through notifications** — auth mail optionally routes via internal HTTP; no other service sends email/SMS/push directly.
2. **Channel providers are strategies** — EMAIL through TEAMS behind one port; simulators fail closed when disabled.
3. **Queue is first-class** — DB-backed queue items with backoff and dead letter; delivery logs for observability.
4. **Webhooks are signed** — HMAC-SHA256; secrets encrypted at rest.
5. **Additive contracts** — optional `NOTIFICATIONS_SERVICE_URL` on auth/gateway.

1. **Custody owns key material and signing** — other services never persist private keys; blockchain may optionally request signatures over HTTP.
2. **Custody models are strategies** (SELF, HOSTED, SHARED, INSTITUTIONAL, MPC, HSM) behind one port — switch via configuration/provider registry.
3. **Private keys never leave the custody boundary** — APIs return metadata/public keys/signatures only; material encrypted at rest.
4. **Approvals and tx policies are data-driven** — no hardcoded business rules in the signing path.
5. **Additive contracts** — optional `CUSTODY_SERVICE_URL` on blockchain; gateway proxies new prefixes only.

1. **Compliance owns KYC/AML/risk/cases/rules** — other services do not embed compliance domain tables or rule engines.
2. **HTTP integration, not in-process imports** — payments calls compliance internal APIs; no service→service workspace package dependency.
3. **Simulators off by default** — `COMPLIANCE_SIMULATOR_ENABLED` defaults false; production boot fails if true.
4. **Fail closed toward money movement** — when compliance URL is configured but unreachable, payments fraud hook denies; when URL is unset, noop allow preserves prior Phase 5 behavior.
5. **Sensitive PII fields encrypted at rest** — AES-256-GCM with `COMPLIANCE_FIELD_ENCRYPTION_KEY`.
6. **Additive contracts only** — new routes, permissions, env vars; no breaking changes to prior phase APIs.
