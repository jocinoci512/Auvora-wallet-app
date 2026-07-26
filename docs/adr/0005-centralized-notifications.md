# ADR 0005: Centralized Notification Platform

- **Status:** Accepted
- **Date:** 2026-07-25
- **Context:** Auth, payments, compliance, and custody all need user communications. Direct SMTP/SMS from each service creates inconsistent delivery, preference handling, and audit.

## Decision

Introduce `@auvora/notifications-service` as the single communication plane.

- Public user/admin APIs via gateway (`/api/v1/notifications`, `/api/v1/admin/notifications`).
- Sibling services call `POST /api/v1/internal/notifications/send` with `x-internal-api-key`.
- Channel providers (email, SMS, push, in-app, browser, webhook, Slack, Teams) are replaceable strategies.
- Templates, preferences, queue, and webhook signing live in this bounded context.

## Consequences

**Positive**

- One preference model and audit trail for all channels
- Consistent retry/dead-letter semantics
- Auth can keep console/SMTP fallback when notifications URL is unset

**Negative**

- Additional hop for auth mail when notifications is enabled
- Real provider adapters still required for production SMS/push

## Alternatives considered

- **Keep per-service mail adapters** — Faster short-term, duplicates preferences and webhooks.
- **External SaaS only** — Couples availability and data residency to a single vendor.
