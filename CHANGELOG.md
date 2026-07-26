# Changelog

All notable changes to this monorepo are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
