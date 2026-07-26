# Phase 7 Integration Report — Custody Platform

**Date:** 2026-07-25  
**Module:** `@auvora/custody-service` (port 3009)  
**Verification:** Full workspace build / lint / typecheck / test — PASS

## Interactions

```text
Browser ──JWT──▶ Gateway :4000 ──proxy──▶ Custody :3009 ──Prisma──▶ Postgres
Blockchain :3003 ──optional internal──▶ Custody /sign  (CUSTODY_SERVICE_URL)
```

| Consumer | Integration |
|----------|-------------|
| Gateway | Proxy `/api/v1/custody`, `/api/v1/admin/custody` |
| Blockchain | Optional `CustodySigningHttpClient` on withdrawal when URL + API key set |
| Auth | New `custody:*` permission codes via seed |
| SDK / Web / Admin | Additive client methods and UI routes |
| Wallet / Payments / Compliance | Untouched |

## Boundaries

- No workspace service→service package dependency.
- Private key material never returned from REST responses.
- Gateway continues to deny `/api/v1/internal/**`.

## Compatibility

Additive only. Withdrawals without `custodyKeyId` retain Phase 4 stub broadcast behavior.
