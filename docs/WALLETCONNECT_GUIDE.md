# WalletConnect Guide

**Phase:** 23  
**Service:** `@auvora/connections-service` (port **3016**)

## Session lifecycle

1. **Create** — `POST /api/v1/connections/walletconnect/sessions`  
   Returns encrypted URI, QR payload, and deep link for mobile wallets.
2. **Approve** — `POST .../sessions/:sessionId/approve` with accounts  
   Activates the session and creates an external connection (`canSign: true`).
3. **Reject** — `POST .../sessions/:sessionId/reject`
4. **Restore** — `POST .../sessions/:sessionId/restore`
5. **Terminate** — `POST .../sessions/:sessionId/terminate`

List sessions: `GET /api/v1/connections/walletconnect/sessions`

## QR & deep links

Providers return `qrPayload` and `deepLink` on proposal creation. URIs are encrypted at rest; plaintext is only returned at creation time when needed for UX.

## Permissions

Session permissions are stored as JSON (e.g. `accounts`, `sign`). Multiple concurrent sessions per user are supported.

## Monitoring

The session monitor worker expires `ACTIVE` sessions past `expiresAt`. Admin analytics: `GET /api/v1/admin/connections/sessions`.
