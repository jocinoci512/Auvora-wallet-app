# Production Readiness — Notification Platform

Last verified: **2026-07-26**

This checklist documents each production-readiness claim for
`@auvora/notifications-service`, how it was implemented, and how to verify/operate it.
See also: [`docs/diagrams/notification-communication-flow.md`](./diagrams/notification-communication-flow.md).

## A. Channel enable/disable without code changes

| Claim                                                | Implementation                                                                                                                                                                                             | How to verify                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Channels can be disabled at runtime without a deploy | `ChannelProviderRegistry.resolve()` checks an env kill-switch first, then queries `notification_channel_providers` (`isEnabled`, ordered by `priority`)                                                    | `provider-registry.spec.ts`                                           |
| Two independent disable mechanisms                   | (1) Env flags `NOTIFICATIONS_CHANNEL_{EMAIL,SMS,PUSH,IN_APP,BROWSER,WEBHOOK,SLACK,TEAMS}_ENABLED` (default `true`) — hard kill-switch, checked before DB. (2) DB `isEnabled` column, toggled via Admin API | Set flag to `false` and restart, or call the admin endpoint below     |
| No enabled provider → safe failure                   | Throws `ProviderUnavailableError` (never silently drops or crashes the worker)                                                                                                                             | `provider-registry.spec.ts` — "throws when no enabled provider" cases |
| Real HTTP backends                                   | `HttpChannelProvider` POSTs `{notificationId, recipient, subject, body, metadata}` with optional `Authorization: Bearer <token>` to `NOTIFICATIONS_{CHANNEL}_PROVIDER_URL`                                 | `http-channel.provider.ts` + provider-registry tests                  |
| In-platform channels                                 | `LocalInAppProvider` marks `IN_APP`/`BROWSER` deliveries successful without an external call (in-app inbox is platform-owned)                                                                              | `local-in-app.provider.ts`                                            |
| Admin operability                                    | `DashboardService.setProviderEnabled(id, enabled)`, `refreshHealth()`; `POST /providers/:id/enable`, `POST /providers/:id/disable`, `POST /providers/refresh-health`                                       | `dashboard.service.spec.ts`, `admin-notifications.controller.ts`      |

### How to disable a channel in production

1. **Fast/emergency kill-switch (requires restart):** set `NOTIFICATIONS_CHANNEL_SMS_ENABLED=false` in the service environment and redeploy/restart. Takes priority over any DB row.
2. **Operational toggle (no restart):** `POST /api/v1/admin/providers/:id/disable` (and `/enable` to re-enable) — flips `notification_channel_providers.isEnabled`, picked up on the next `resolve()` call.

## B. Webhook auto-retry (in addition to existing notification retry/DLQ)

- `WebhookService.processNextRetry(workerId)` claims one `WebhookDelivery` row where
  `status=RETRYING AND nextAttemptAt <= now()` via an atomic `RETRYING -> PENDING`
  update, then re-dispatches it.
- `WebhookRetryWorkerService` polls on `NOTIFICATIONS_QUEUE_POLL_INTERVAL_MS`, gated by
  `NOTIFICATIONS_WEBHOOK_WORKER_ENABLED` (default `true`), mirroring the existing
  `QueueWorkerService` pattern.
- Verified in `webhook.service.spec.ts` (claim success + empty-queue no-op).

## C. Correlation ID + originating event linkage

- `NotificationService.send()` always sets `correlationId = input.correlationId ?? randomUUID()` — never `null` on create.
- `SendNotificationInput` / `InternalSendNotificationDto` accept optional `sourceEventType`, `sourceEventId`, stored both as indexed columns (`notification_messages.source_event_type`, `source_event_id`) and inside `metadata` for redundancy.
- `correlationId` is threaded through every `events.publish(...)` call in `notification.service.ts` and `queue.service.ts`, and recorded in `NotificationDeliveryLog.responseMeta`.
- Migration: `database/prisma/migrations/20260726040000_notification_traceability/migration.sql` adds the columns plus `@@index([sourceEventType, createdAt])` and `@@index([correlationId])`.
- `NotificationsMailAdapter` (auth service) generates its own `correlationId` and stamps `sourceEventType='auth.mail.send'` on every mail-via-notifications call.
- Verified in `notification.service.spec.ts` ("correlationId is always set" cases).

## D. Preferences — frequency limits

- `preference-policy.ts` adds `frequencyLimits: Record<string, { maxPerHour?; maxPerDay? }>` (keyed by channel or category) and a new `FREQUENCY_LIMIT` suppression reason.
- `PreferenceService.evaluateSuppression` counts non-`SUPPRESSED` `NotificationMessage` rows for `ownerUserId + channel` over the last hour/day and passes `recentHourCount`/`recentDayCount` into the policy.
- `CRITICAL` priority notifications always bypass frequency limits.
- Verified in `preference-policy.spec.ts` and `preference.service.spec.ts`.

## E. Webhooks — versioned envelopes

- `WebhookService.dispatch()` wraps the delivery payload as
  `{ apiVersion, eventType, deliveredAt, data }` before HMAC-signing and sending;
  `apiVersion` comes from `WebhookEndpoint.version` (settable via `UpdateWebhookInput.version`).
- Verified in `webhook.service.spec.ts` (envelope shape + signature-over-envelope assertions).

## F. Cross-module event publishers

Every producing service (`auth`, `wallet`, `payments`, `compliance`, `custody`,
`blockchain`) has a thin `NotificationsPublisherAdapter`
(`infrastructure/notifications/notifications-publisher.adapter.ts`) exposing
`NOTIFICATIONS_PUBLISHER: NotificationsPublisherPort { publishEvent(input) }`. It is:

- **Fire-and-forget** — errors are logged (`Logger.warn`) and never rethrown, so a
  notification-platform outage cannot fail a business transaction.
- **No-op by default** — if `NOTIFICATIONS_SERVICE_URL` or `INTERNAL_API_KEY` are not
  configured, it logs at `debug` and returns immediately.
- **Wired into a real completion path in each service:**

| Service    | Wired call site                                                         | Event type                          |
| ---------- | ----------------------------------------------------------------------- | ----------------------------------- |
| Auth       | `NotificationsMailAdapter.send`                                         | (mail dispatch, not a domain event) |
| Wallet     | `WalletService.createInternalTransfer`                                  | `wallet.transfer.completed`         |
| Payments   | `PaymentOrchestratorService` (wallet + provider routes)                 | `payment.completed`                 |
| Compliance | `KycService.approve`                                                    | `compliance.kyc.approved`           |
| Custody    | `SigningService.execute` (successful sign)                              | `custody.signing.completed`         |
| Blockchain | `ConfirmationEngine.updateTransactionConfirmations` (threshold reached) | `blockchain.transaction.confirmed`  |

## G. Documentation

- Communication flow diagram: [`docs/diagrams/notification-communication-flow.md`](./diagrams/notification-communication-flow.md)
- This checklist: `docs/PRODUCTION_READINESS_NOTIFICATIONS.md`
- `BUILD_STATUS.md` updated with the latest verification pass.
- `.env.example` updated with channel kill-switches, per-channel provider URLs/tokens, and the webhook worker flag.

## H. Test coverage added/updated for this pass

- `provider-registry.spec.ts` — env kill-switch, DB `isEnabled`, HTTP + local providers, unavailable fallback.
- `webhook.service.spec.ts` — versioned envelope, `processNextRetry` claim/no-op.
- `preference.service.spec.ts` / `preference-policy.spec.ts` — frequency limit suppression (hour/day caps, CRITICAL bypass).
- `notification.service.spec.ts` — correlationId always set, sourceEventType/sourceEventId persisted.
- `dashboard.service.spec.ts` — `setProviderEnabled`, `refreshHealth`.
- `signing.service.spec.ts`, `confirmation-engine.service.spec.ts`, `kyc.service.spec.ts` — updated for the new `NOTIFICATIONS_PUBLISHER` dependency.

Full suite status at time of writing: `notifications-service` 13/13 suites, 88/88 tests;
`compliance-service` 7/7, 39/39; `custody-service` 7/7, 51/51; `blockchain-service` 6/6,
31/31; `wallet-service` 3/3, 14/14; `payments-service` 4/4, 27/27 — all passing, lint
clean, `nest build` clean.

## Known gaps / follow-ups

- `NotificationsPublisherAdapter` is fire-and-forget with no outbox/at-least-once
  guarantee; if the notification platform is down at the moment of the call, that
  specific event is dropped (logged, not queued for later replay). A durable outbox
  pattern would be a natural next step if delivery guarantees become a hard
  requirement.
- Wallet/Payments/Compliance/Custody/Blockchain each wire only 1 representative
  "completed" event as requested; broader event coverage (e.g. failed/cancelled paths)
  is not yet wired.
- `HttpChannelProvider` timeout/retry is basic (single attempt + timeout); it relies on
  the existing queue-level retry/backoff for resilience rather than provider-level retry.
