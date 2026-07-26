# ADR 0006: Centralized Enterprise AI Platform

## Status

Accepted — 2026-07-26

## Context

Multiple Auvora modules need intelligent assistance (support chat, transaction explanations, compliance summaries, knowledge search). Calling OpenAI/Anthropic/Gemini directly from each app would scatter secrets, duplicate prompt/RAG logic, and break auditability.

## Decision

1. **All AI traffic goes through `@auvora/ai-service` (port 3008).** Web/Admin use the gateway; other services use the internal API with `x-internal-api-key`.
2. **Provider ports + model router** — OpenAI, Anthropic, Gemini, Azure OpenAI, Local, and Simulator implement one `AiProviderPort`. Selection is priority-based with failover. Credentials come from environment (and optionally encrypted DB config), never hardcoded.
3. **Simulator is the default non-prod backend** — `AI_SIMULATOR_ENABLED` must be `false` in production.
4. **RAG is first-class** — knowledge sources → documents → chunks → embeddings → cosine semantic search with source attribution, stored in Postgres for MVP (no external vector DB required).
5. **Prompts are versioned products** — templates with approval workflow, preview, rollback.
6. **Safety hooks** — input validation, PII redaction hooks, RBAC (`ai:*`), rate limits, token/cost tracking, immutable audit trail.
7. **Additive contracts only** — optional `AI_SERVICE_URL` on the gateway; prior phases unchanged when unset.

## Consequences

- Applications never hold provider API keys.
- Adding a new LLM vendor is a new adapter + DB provider row.
- In-DB vector search is sufficient for seeded knowledge; a dedicated vector store can replace `VectorSearchService` later without changing API contracts.
