# Changelog

All notable changes to this monorepo are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — Phase 16 UX / UI polish

### Added

- `@auvora/ui` primitives: `PageHeader`, `AsyncStates`, `StatusBadge` (plus prior Alert / EmptyState / Skeleton).
- App `Subnav` with `aria-current` for section navigation (Web + Admin).
- ADR [0011](docs/adr/0011-shared-ux-primitives.md) — shared UX primitives decision.
- Expanded `perf:a11y` checks for skip-link and `#main-content`.

### Changed

- Collapsible API token panel; AI chat layout; payments / wallets / ops / alerts presentation polish.
- Shared UI styles for chat, metric cards, page headers; tables use scroll wrappers + captions where upgraded.
- Refreshed [`UX_REVIEW.md`](UX_REVIEW.md), [`UI_CONSISTENCY_REPORT.md`](UI_CONSISTENCY_REPORT.md), [`ACCESSIBILITY_REPORT.md`](ACCESSIBILITY_REPORT.md).

## [1.0.0-rc.1] — 2026-07-26

### Added — Phase 14 Final Production Readiness & Release Candidate

- Release Candidate packaging: root version **1.0.0-rc.1**, [`docs/RELEASE_NOTES.md`](docs/RELEASE_NOTES.md), [`docs/RELEASE_CANDIDATE_v1.0.md`](docs/RELEASE_CANDIDATE_v1.0.md).
- Production docs: API_DOCUMENTATION, SECURITY_GUIDE, OPERATIONS_GUIDE, RUNBOOKS.
- Wallet address validation fail-closed local format checks when blockchain URL unset (RB1).
- Gateway `/metrics/resilience` protected by `x-internal-api-key` when `INTERNAL_API_KEY` set or `NODE_ENV=production` (RB3).
- Embedded Postgres migrate script skips re-init when data directory already initialized.

### Changed

- Gateway default `SERVICE_VERSION` → `1.0.0-rc.1`.
- FINAL_RELEASE_CHECKLIST / BUILD_STATUS updated for Phase 14 RC.

### Changed — Code Quality Audit (post-RC refresh)

- Aligned SDK/OpenAPI to Nest for AI knowledge search (POST), admin knowledge sources, analytics insights/aggregate, custody recovery docs.
- Removed unused `@nestjs/terminus` from Nest services; docs app port **3011** (was colliding with wallet **3002**).
- Refreshed [`CODE_QUALITY_REPORT.md`](CODE_QUALITY_REPORT.md), [`TECHNICAL_DEBT_REPORT.md`](TECHNICAL_DEBT_REPORT.md), [`FINAL_RELEASE_CHECKLIST.md`](FINAL_RELEASE_CHECKLIST.md).

## [1.3.0] — 2026-07-26

### Added — Phase 13 Performance, Scalability, Security Hardening & Resilience

- **`@auvora/resilience`**: timeout, retry/backoff, circuit breaker, bulkhead, `resilientCall` + metrics.
- **`@auvora/cache`**: memory store, read-through/write-through, TTL policy constants, invalidation, hot-key tracking.
- **Gateway**: edge rate limiting, proxy timeouts, hardened headers (COOP/CORP/HSTS), DB pool URL defaults, `/metrics/resilience`, resilient proxy helper.
- **Database**: `withDatabaseUrlPool` / `applyDatabasePoolEnv` helpers.
- **Frontend**: compression, `optimizePackageImports`, security headers on Web/Admin.
- **Perf harness**: `scripts/perf/load-test.mjs`, `run-suite.mjs`, `chaos-test.mjs`, `a11y-smoke.mjs` + npm scripts `perf:load|chaos|a11y`.
- Docs: `PERFORMANCE_REPORT.md`, `SECURITY_HARDENING.md`, `LOAD_TEST_RESULTS.md`, `CHAOS_TEST_RESULTS.md`, ADR [0010](docs/adr/0010-resilience-and-cache.md).

### Changed

- AI request cache default TTL **120s** (aligned to platform cache policy).
- Security package exports `FixedWindowRateLimiter` and additional header constants.

### Changed — Enterprise Readiness Verification

- Extended perf harness: `benchmark-compare.mjs`, `journey-smoke.mjs`, `resilience-sim.mjs` + scripts `perf:benchmark|journeys|resilience`.
- Dependency overrides: `nodemailer@9.0.1`, `sharp@0.35.0`, `postcss@8.5.18`, `js-yaml@5.2.2`, major-scoped `brace-expansion` patches (avoids ESLint breakage from global 5.x pin).
- Architecture diagram: [`docs/diagrams/scalability-resilience-topology.md`](docs/diagrams/scalability-resilience-topology.md).
- Updated evidence docs: BUILD_STATUS, PERFORMANCE_REPORT, SECURITY_HARDENING, LOAD_TEST_RESULTS, ARCHITECTURE_DECISIONS.

### Changed — Code Quality Audit

- Aligned gateway OpenAPI custody/auth paths with Nest + SDK; removed phantom `/api/v1/admin/sessions`.
- SDK default request timeout (30s); wallet blockchain validate timeout (5s).
- Gateway proxies honor `PROXY_TIMEOUT_MS`; Next apps share COOP/CORP/XSS headers; docs drops unused `@auvora/sdk`.
- Reports: [`CODE_QUALITY_REPORT.md`](CODE_QUALITY_REPORT.md), [`TECHNICAL_DEBT_REPORT.md`](TECHNICAL_DEBT_REPORT.md), [`FINAL_RELEASE_CHECKLIST.md`](FINAL_RELEASE_CHECKLIST.md).

### Compatibility

- Additive libraries and gateway middleware. Domain services unchanged unless they adopt the new packages.

## [1.2.0] — 2026-07-26

### Added — Phase 12 Enterprise Production Infrastructure

- **Terraform** modules under `infrastructure/terraform/modules` (networking, kubernetes, postgres, redis, storage, secrets, iam, dns, loadbalancer, monitoring) with per-env tfvars examples.
- **Helm** umbrella chart `infrastructure/helm/auvora-wallet` (Deployments, StatefulSets, Services, Ingress, ConfigMaps/Secrets, HPA, PDB, NetworkPolicy, RBAC) + values for local/development/qa/testing/staging/production/disaster-recovery.
- **Kustomize** overlays for the same seven environments.
- **Docker** multi-stage non-root images (`Dockerfile.service`, `Dockerfile.next`) with healthchecks.
- **Secrets package** `@auvora/secrets` (env / k8s / vault / aws_sm / azure_kv factory).
- **Prisma** migration `20260726150000_infrastructure_platform`; seed **1.2.0** with infra permissions, environments, feature flags, sample deployment/backup.
- **Admin infrastructure portal** + Observability admin APIs (`/api/v1/admin/infrastructure/*`); gateway proxy + OpenAPI stubs; SDK client methods.
- **CI/CD**: `infra-validate`, `build-images`, `sign-images`, `image-scan`, `security-scan`, `deploy`, `release` workflows.
- Docs: [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md), [`docs/DISASTER_RECOVERY.md`](docs/DISASTER_RECOVERY.md), ADR [0009](docs/adr/0009-cloud-agnostic-infrastructure.md).

### Changed — Production Deployment Readiness

- Helm strategies: `rolling` / `blue-green` / `canary` with traffic selectors, canary Deployments/Services, and Deploy workflow wiring.
- Secrets: External Secrets by default; chart Secret only for local (`secrets.create`); removed committed placeholder credentials from base/production values.
- Containers: startup + liveness + readiness probes; non-root securityContext on services/apps/postgres/redis.
- Backup CronJob template + validated RPO/RTO procedures in `DISASTER_RECOVERY.md`.
- CI: `deployment-artifacts` job + `validate-deployment-artifacts.sh`; PR security gates in `ci.yml`.
- Diagrams: environments, networking, service topology; checklist [`docs/PRODUCTION_READINESS_DEPLOYMENT.md`](docs/PRODUCTION_READINESS_DEPLOYMENT.md).

### Compatibility

- Additive only. Application services unchanged when not deploying via Helm/K8s.

## [1.1.0] — 2026-07-26

### Added — Phase 11 Enterprise Observability & SRE

- **Observability service** (`services/observability`, port 3010): metrics ingest, distributed traces/spans, masked log aggregation, health monitoring, alert rules + evaluation worker, incident management, SLO/SLI measurements, capacity samples/forecast, dependency graph, maintenance notices, ops dashboard.
- **Prisma** migration `20260726140000_observability_platform`; seed **1.1.0** with obs permissions, metric/alert/SLO/dependency seeds.
- **Gateway** `OBSERVABILITY_SERVICE_URL` proxy + OpenAPI stubs.
- **SDK** platform status + admin ops client methods; **Web** `/status`; **Admin** `/observability/*` portals.
- Cross-module `ObservabilityPublisherAdapter` + readiness health reporting on auth/wallet/blockchain/payments/compliance/custody/notifications/AI/analytics.
- Permissions: `observability:read|write|admin|alerts|incidents|slo`.

### Changed — Operational Readiness Verification

- Correlation middleware on gateway/auth/wallet; gateway propagates `traceparent`/`tracestate`/`x-correlation-id` on proxies.
- HTTP metrics interceptor emits `http_latency_ms` and `error_rate` from platform services.
- Alert rules: `PATCH /admin/observability/alert-rules/:code` for enable/disable/modify without code changes.
- SLO compliance report: `GET /admin/observability/slos/compliance` (latency, error rate, uptime vs targets).
- Worker readiness checks for analytics aggregation, notifications queue, and observability alert worker.
- Runtime dependency diagram: `docs/diagrams/runtime-service-dependency-graph.md`.

### Compatibility

- Additive only. Prior phases unchanged when `OBSERVABILITY_SERVICE_URL` is unset.

## [1.0.0] — 2026-07-26

### Added — Phase 10 Enterprise Analytics & BI

- **Analytics service** (`services/analytics`, port 3007): event ingest, metrics engine, incremental aggregation worker, configurable KPIs, dashboards/widgets, report templates + encrypted exports (JSON/CSV/XLSX/PDF stubs), scheduled reports, linear-trend forecasting, executive insights.
- **Prisma** migration `20260726120000_analytics_platform`; seed **1.0.0** with metric/KPI definitions, system dashboards, report templates, forecast models.
- **Gateway** `ANALYTICS_SERVICE_URL` proxy + OpenAPI stubs.
- **SDK** analytics client methods; **Web** `/analytics`; **Admin** dashboards/KPIs/reports/forecasts/metrics.
- Cross-module `AnalyticsPublisherAdapter` on auth, wallet, payments, compliance, custody, blockchain, notifications, AI.
- Permissions: `analytics:read|write|admin|reports|dashboards|kpis`.

### Changed — Analytics Governance & Data Quality

- Publishers require `domain` (and send optional `metrics` / `sourceService`) so internal ingest always matches `InternalIngestEventDto`.
- Scheduled reports: migration `20260726130000_analytics_scheduled_retry` (`attemptCount`, `maxAttempts`, `lastError`, `nextAttemptAt`) with exponential backoff before terminal `FAILED`.
- Admin metric create/update; `GET /api/v1/admin/analytics/performance` for dashboard/report/aggregation SLIs.
- SHARED dashboards restricted to owner or admin; performance metric codes seeded (`dashboard_load_ms`, `report_generate_ms`, `aggregation_duration_ms`).
- Docs: `docs/PRODUCTION_READINESS_ANALYTICS.md`, `docs/diagrams/analytics-data-flow.md`.

### Compatibility

- Additive only. Prior phases unchanged when `ANALYTICS_SERVICE_URL` is unset.

## [0.9.0] — 2026-07-26

### Added — Phase 9 Enterprise AI Platform

- **AI service** (`services/ai`, port 3008): AI gateway, model router with provider failover, prompt manager + versioning/approval, conversation/session management, embedding + in-DB vector search (RAG), knowledge sources/documents/chunking, token/cost tracking, safety hooks (validation, PII redaction), automation helpers (case/payment/transaction summaries), modular assistants.
- **Providers:** OpenAI, Anthropic, Gemini, Azure OpenAI, Local LLM, Simulator (gated by `AI_SIMULATOR_ENABLED`; production refuses if true).
- **Prisma** migration `20260726100000_ai_platform`; seed **0.9.0** with providers, prompt templates, knowledge source, vector index meta.
- **Gateway** `AI_SERVICE_URL` proxy + OpenAPI stubs for `/api/v1/ai` and `/api/v1/admin/ai`.
- **SDK** AI client methods; **Web** `/ai` chat + `/ai/knowledge`; **Admin** dashboard, providers, prompts, knowledge, usage, conversations.
- Permissions: `ai:read|write|admin|prompts|knowledge|chat`.

### Compatibility

- Additive only. Prior phases unchanged when `AI_SERVICE_URL` is unset.

## [0.8.0] — 2026-07-25

### Added — Phase 8 Notification Platform

- **Notifications service** (`services/notifications`, port 3006): multi-channel delivery engine, template engine + versioning, user preferences, webhook platform (HMAC), queue with exponential backoff and dead letter, broadcast, dashboard metrics.
- **Providers:** EMAIL, SMS, PUSH, IN_APP, BROWSER, WEBHOOK, SLACK, TEAMS (simulators gated by `NOTIFICATIONS_SIMULATOR_ENABLED`).
- **Prisma** migration `20260726020000_notification_platform`; seed **0.8.0** with channel providers and default templates.
- **Gateway** `NOTIFICATIONS_SERVICE_URL` proxy + OpenAPI stubs.
- **Auth** optional `NotificationsMailAdapter` when notifications URL + internal API key are set (falls back to console/SMTP).
- **SDK** notification/webhook client methods; **Web** notification center; **Admin** dashboard, templates, queue, failed, broadcast, webhooks.
- Permissions: `notification:read|write|admin|templates|webhooks|broadcast`.

### Compatibility

- Additive only. Auth continues to use local mail when notifications URL is unset.

## [0.7.0] — 2026-07-25

### Added — Phase 7 Custody Platform

- **Custody service** (`services/custody`, port 3009): key lifecycle, signing engine, approval workflows, multi-sig signer groups, recovery policies/contacts, transaction policy engine, provider registry (SELF/HOSTED/SHARED/INSTITUTIONAL/MPC/HSM), audit + event logs.
- **Internal API** (`x-internal-api-key`): generate key, sign, verify, policy evaluate.
- **Simulators** gated by `CUSTODY_SIMULATOR_ENABLED` (production refuses if true); private material AES-256-GCM encrypted via `CUSTODY_FIELD_ENCRYPTION_KEY` and never returned from APIs.
- **Prisma** migration `20260726010000_custody_platform`; seed **0.7.0** with custody permissions, six providers, approval/recovery/tx policies.
- **Gateway** `CUSTODY_SERVICE_URL` proxy + OpenAPI stubs.
- **Blockchain** optional custody signing hook on withdrawals (`custodyKeyId`) when custody URL configured.
- **SDK** custody client methods; **Web** security/signing/recovery/activity; **Admin** dashboard, keys, queues, policies, signers, audit.

### Compatibility

- Additive routes, permissions, and optional env vars only.
- Existing Auth/Wallet/Blockchain/Payments/Compliance APIs unchanged.
- Blockchain withdrawals without `custodyKeyId` keep prior unsigned-stub broadcast behavior.

## [0.6.0] — 2026-07-25

### Added — Phase 6 Compliance Platform

- **Compliance service** (`services/compliance`, port 3005): KYC profiles/verifications, documents, risk scoring + history, sanctions/PEP screening surfaces, AML alerts, investigation cases, rules CRUD/enable-disable, provider registry, dashboard/reports.
- **Internal policy API** (`x-internal-api-key`): `POST /api/v1/internal/compliance/policy/evaluate`, `POST /api/v1/internal/compliance/fraud/check`.
- **Provider ports** with simulator adapters (gated by `COMPLIANCE_SIMULATOR_ENABLED`; production refuses boot if simulators are enabled) and fail-closed unavailable adapters when disabled.
- **Field encryption** (AES-256-GCM) via `COMPLIANCE_FIELD_ENCRYPTION_KEY`.
- **Prisma** compliance domain models + migration `20260725210000_compliance_platform`.
- **Seed 0.6.0**: `compliance:read|write|admin|review|cases|rules` permissions, nine provider records, four default rules; user role gains `compliance:read` / `compliance:write`.
- **Gateway** `COMPLIANCE_SERVICE_URL` proxy + OpenAPI stubs for user/admin compliance routes.
- **Payments** optional `ComplianceFraudHttpClient` behind existing `FraudHookPort` (noop when URL unset).
- **SDK** compliance types and methods (profile, KYC, documents, risk/history, admin dashboard/alerts/cases/rules/providers, rule CRUD, risk recompute).
- **Web** `/compliance`, `/compliance/documents`.
- **Admin** `/compliance`, `/compliance/alerts`, `/compliance/cases`, `/compliance/rules`.
- Architecture integrity docs: `BUILD_STATUS.md`, this changelog, `ARCHITECTURE_DECISIONS.md`, integration report, dependency diagram.

### Changed

- `@auvora/types` `PermissionCode` extended with compliance permission literals (additive).
- `@auvora/database` re-exports compliance enums from `@auvora/database-schema`.
- TypeDoc generation scoped to shared packages (`docs/typedoc.tsconfig.json`, `--skipErrorChecking`).

### Compatibility

- No existing public Auth/Wallet/Blockchain/Payments routes removed or renamed.
- Payments fraud integration is opt-in via `COMPLIANCE_SERVICE_URL`.
- Gateway continues to deny `/api/v1/internal/**` from the public edge.

## [0.5.0] — 2026-07-25

### Added — Phase 5 Payments Platform

- Payments service, gateway proxy, settlement/reconciliation surfaces, SDK/UI integration (prior enterprise build phase).

## [0.1.0] — 2026-07-25

### Added — Foundation through Phase 4

- Monorepo foundation, Auth, Wallet, Blockchain platforms and shared packages.
