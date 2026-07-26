# Architecture Decisions

Index of architecture decision records (ADRs) from foundation through Phase 13 (performance, security hardening, and resilience).

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
| [0008](docs/adr/0008-centralized-observability.md) | Centralized observability & SRE platform | Accepted |
| [0009](docs/adr/0009-cloud-agnostic-infrastructure.md) | Cloud-agnostic production infrastructure | Accepted |
| [0010](docs/adr/0010-resilience-and-cache.md) | Shared resilience & cache libraries | Accepted |

## Phase 13 decision summary

1. **Shared `@auvora/resilience` + `@auvora/cache`** — measurable timeouts, retries, circuits, bulkheads, and cache hit/miss/hot-key metrics.
2. **Gateway edge hardening** — rate limits, proxy timeouts, COOP/CORP/HSTS, DB pool URL defaults, `/metrics/resilience`.
3. **No domain rewrites** — incremental adoption; existing backoff/AI cache retained.
4. **Perf harness in-repo** — Node load/chaos/a11y scripts; results docs under `docs/`.
5. Evidence: [`docs/PERFORMANCE_REPORT.md`](docs/PERFORMANCE_REPORT.md), [`docs/SECURITY_HARDENING.md`](docs/SECURITY_HARDENING.md), [`docs/LOAD_TEST_RESULTS.md`](docs/LOAD_TEST_RESULTS.md), ADR [0010](docs/adr/0010-resilience-and-cache.md).

## Enterprise Readiness Verification decisions

1. **Measure before claiming improvement** — `perf:benchmark` encodes Phase 12 baseline vs Phase 13 after metrics (TTL, timeouts, hit ratio, health p95).
2. **Journey smoke tolerates infrastructure degradation** — auth login skips when `/ready` reports unhealthy DB; gateway 504s document missing upstreams without failing the suite falsely.
3. **Dependency remediation is scoped** — force-patch `nodemailer`/`sharp`/`postcss`/`js-yaml`; major-scoped `brace-expansion` (global 5.x breaks ESLint); defer coordinated OpenTelemetry major upgrade as accepted high risk until Phase 14+.
4. **Topology docs are first-class** — [`docs/diagrams/scalability-resilience-topology.md`](docs/diagrams/scalability-resilience-topology.md) covers scale plane, resilience libs, and multi-env deploy.
5. **Phase 14 RC shipped** — ERV gated GA; Phase 14 produced **v1.0.0-rc.1** (see Phase 14 summary below).

## Phase 14 decision summary

1. **Ship RC not GA** — `v1.0.0-rc.1` for staging soak; GA requires remaining checklist items (pen-test, staging load, full service matrix).
2. **Close RB1/RB3** — fail-closed local address format validation; protect `/metrics/resilience` with `INTERNAL_API_KEY`.
3. **Accept OTEL highs for RC** — documented in SECURITY_GUIDE; upgrade is a coordinated post-RC train.
4. **Evidence package** — [`docs/RELEASE_CANDIDATE_v1.0.md`](docs/RELEASE_CANDIDATE_v1.0.md) consolidates the 19 RC deliverable sections.
5. **No domain feature churn** — Phase 14 changes are defect/stability/docs/versioning only.

## Phase 12 decision summary

1. **IaC under `infrastructure/`** — Terraform module interfaces, Helm umbrella chart, Kustomize overlays for seven environments.
2. **Cloud-agnostic by default** — modules start `enabled=false`; provider wiring is additive.
3. **Secrets externally managed** — External Secrets Operator for non-local; chart Secret local-only; `@auvora/secrets` runtime factory; no production credentials in git.
4. **Ops data plane in Observability** — deployments, backups, recovery drills, feature flags + Admin `/infrastructure`.
5. **Deployment strategies in chart** — `rolling` / `blue-green` / `canary` via `global.deploymentStrategy`.
6. **Supply chain** — non-root images + startup/liveness/readiness probes; GHCR build; Cosign; Trivy/gitleaks; Helm/Terraform validate before deploy.
7. **DR is an environment + measured runbooks** — RPO ≤15m / RTO ≤60m; see [`docs/DISASTER_RECOVERY.md`](docs/DISASTER_RECOVERY.md), [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md), [`docs/PRODUCTION_READINESS_DEPLOYMENT.md`](docs/PRODUCTION_READINESS_DEPLOYMENT.md).
8. Evidence: ADR [0009](docs/adr/0009-cloud-agnostic-infrastructure.md), diagrams under `docs/diagrams/`.

## Phase 11 decision summary

1. **All operational telemetry goes through `@auvora/observability-service`** — modules publish; they do not own ops dashboards.
2. **Local otel/logger/health are retained** and feed the central plane.
3. **Alerts/incidents/SLOs/capacity are configuration + workflow**, not hardcoded ops playbooks; alert rules are PATCH-mutable.
4. **Log ingest masks secrets** before persistence; HTTP interceptors emit latency/error metrics with correlation IDs.
5. **Gateway propagates W3C + correlation headers** across proxied hops.
6. **Additive contracts** — optional `OBSERVABILITY_SERVICE_URL`.
7. Evidence: ADR [0008](docs/adr/0008-centralized-observability.md), [`docs/PRODUCTION_READINESS_OBSERVABILITY.md`](docs/PRODUCTION_READINESS_OBSERVABILITY.md), [`docs/diagrams/runtime-service-dependency-graph.md`](docs/diagrams/runtime-service-dependency-graph.md).

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
