# Phase 8 Integration Report — Notification Platform

**Date:** 2026-07-25  
**Module:** `@auvora/notifications-service` (port 3006)  
**Verification:** Full workspace build / lint / typecheck / test — PASS

## Interactions

```text
Browser ──JWT──▶ Gateway :4000 ──proxy──▶ Notifications :3006 ──Prisma/Redis──▶ store/queue
Auth :4001 ──optional MailPort──▶ Notifications /internal/send
```

| Consumer | Integration |
|----------|-------------|
| Gateway | Proxy `/api/v1/notifications`, `/api/v1/admin/notifications` |
| Auth | `NotificationsMailAdapter` when `NOTIFICATIONS_SERVICE_URL` + `INTERNAL_API_KEY` set |
| Wallet / Blockchain / Payments / Compliance / Custody | No direct senders yet; ready for internal event ingest |
| SDK / Web / Admin | Additive methods and UI |

## Boundaries

- No service→service workspace package dependency.
- Gateway still denies `/api/v1/internal/**`.
- Simulator providers blocked in production.

## Compatibility

Additive APIs and optional env only. Prior phases unchanged when notifications URL unset.
