# Production Readiness — Enterprise AI Platform (Governance)

Last verified: **2026-07-26**

Checklist mapping each governance claim to implementation evidence.
See also: [`docs/diagrams/ai-system-interaction.md`](./diagrams/ai-system-interaction.md).

## 1. Providers added / removed / reprioritized without code changes — **PASS**

| Capability | Evidence |
|------------|----------|
| Enable / disable | `POST /api/v1/admin/ai/providers/:code/enable\|disable` → `ModelRouterService.setEnabled` |
| Priority | `PATCH /api/v1/admin/ai/providers/:code` or `setPriority` → DB `priority` used by registry failover order |
| Upsert row | `POST /api/v1/admin/ai/providers` → `upsertProvider` for existing `providerType` values |
| Seed safe | Seed **update** does not overwrite `priority` / `isEnabled` |
| Credentials | Env only (`AI_OPENAI_API_KEY`, etc.) — never request body or source |

**Note:** A brand-new `providerType` still needs an adapter case in `AiProviderRegistry.buildBackend`. New rows of OpenAI/Anthropic/Gemini/Azure/Local/Simulator are config-only.

## 2. Correlation IDs + audit records — **PASS**

- Middleware always sets `x-correlation-id`.
- Controllers merge `dto.correlationId ?? @CorrelationId()` header into chat/automation.
- `ChatService` always persists `correlationId = input.correlationId ?? randomUUID()` on `AiRequest`.
- `AuditService.record` used for chat success/failure and provider/prompt/knowledge mutations.
- Domain events carry `correlationId`.

## 3. Prompt versioning, rollback, approval — **PASS**

- Versions immutable; `createVersion` / `rollback` reset status to `DRAFT`.
- Workflow: `DRAFT` → `submitForApproval` → `PENDING_APPROVAL` → `approve` / `reject`.
- Live chat uses `getActiveVersionByCode` which requires `APPROVED && isEnabled`.

## 4. RAG document versions + source attribution — **PASS**

- `ingestDocument` upserts same title → bumps `document.version` and reindexes.
- Search results include `documentVersion`, source id/code/name, document id/title, chunk id, score.
- Only `INDEXED` docs from `isEnabled` sources are searched.
- Chat persists `citations` on assistant message + `AiRequest.metadata`.

## 5. Token usage, latency, cache hit rate, estimated cost — **PASS**

| Metric | Where |
|--------|-------|
| Tokens | `AiTokenUsage`, `GET admin/ai/usage`, dashboard |
| Latency | `AiRequest.latencyMs`, usage `averageLatencyMs`, dashboard |
| Cache hit rate | `AiRequest.cacheHit`, usage + dashboard `cacheHitRate` |
| Estimated cost | `costUsdMicros` / `estimatedCostUsd` (static rate table — not invoices) |
| Per-provider 24h | Dashboard `providerMetrics` from `AiProviderMetric` |

## 6. No secrets in source — **PASS**

- Provider keys only via environment schema.
- No production API key literals under `services/ai`.
- Logger redacts auth/internal-key headers.

## 7. Auth / RBAC / permissions — **PASS**

- Global JWT + roles + permissions guards.
- User endpoints require `ai:chat|read|knowledge`.
- Admin endpoints require admin/super_admin + `ai:admin|prompts|knowledge`.
- Internal endpoints: `InternalApiKeyGuard` only; not gateway-proxied.
- Feedback enforces conversation ownership (admin override with `ai:admin`).

## Documentation updates

- Diagram: `docs/diagrams/ai-system-interaction.md`
- This checklist: `docs/PRODUCTION_READINESS_AI.md`
- ADR: `docs/adr/0006-centralized-ai-platform.md`
- Integration: `docs/INTEGRATION_REPORT_PHASE9.md`
- Status: `BUILD_STATUS.md`, `CHANGELOG.md` `[0.9.0]`, `ARCHITECTURE_DECISIONS.md`

## Known follow-ups (non-blocking)

- Per-row `configEncrypted` credentials (env remains source of truth today).
- Dedicated vector DB if knowledge corpus outgrows in-Postgres cosine search.
- Durable outbox for `AiPublisherAdapter` (currently fire-and-forget).
