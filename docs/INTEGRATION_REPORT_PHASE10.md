# Phase 10 Integration Report — Analytics & BI

**Date:** 2026-07-26  
**Module:** `@auvora/analytics-service` (port 3007)  
**Seed:** 1.0.0  
**Migration:** `20260726120000_analytics_platform`

## Interactions

```text
Domain services ──x-internal-api-key──▶ Analytics /internal/events
Browser ──JWT──▶ Gateway :4000 ──proxy──▶ Analytics :3007
```

| Producer | Event examples |
|----------|----------------|
| Auth | `auth.login.completed` |
| Wallet | `wallet.transfer.completed` |
| Payments | `payment.completed` |
| Compliance | `compliance.kyc.approved` |
| Custody | `custody.signing.completed` |
| Blockchain | `blockchain.transaction.confirmed` |
| Notifications | `notification.sent` |
| AI | `ai.chat.completed` |

## Boundaries

- No service→service workspace package imports.
- Gateway denies `/api/v1/internal/**`.
- KPI/metric definitions are configuration, not code.

## Compatibility

Additive APIs, permissions (`analytics:*`), and optional env only.
