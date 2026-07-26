# API Documentation

**Version:** Auvora Wallet **v1.0.0-rc.1**  
**Entry point:** Gateway `http://localhost:4000`  
**Interactive OpenAPI:** [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

Clients should call the **gateway only**. Domain services are not public edge APIs.

## Authentication

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Body: `email`, `password`, `deviceFingerprint` (≥8), optional `deviceName` |
| POST | `/api/v1/auth/refresh` | Cookie or body refresh token |
| POST | `/api/v1/auth/logout` | End session |
| POST | `/api/v1/auth/verify-email` | Email verification token |
| POST | `/api/v1/auth/forgot-password` / `reset-password` | Password recovery |
| GET/PATCH | `/api/v1/me` | Authenticated profile |

Use `Authorization: Bearer <accessToken>` for user/admin APIs. CSRF header required for cookie-authenticated mutating routes.

## Domain surfaces (via gateway)

| Area | Prefix examples |
|------|-----------------|
| Wallets | `/api/v1/wallets`, `/api/v1/admin/wallets` |
| Blockchain | `/api/v1/blockchain/*`, `/api/v1/admin/blockchain/*` |
| Payments | `/api/v1/payments/*`, `/api/v1/admin/payments/*` |
| Compliance / KYC | `/api/v1/compliance/*`, `/api/v1/admin/compliance/*` |
| Custody / signing | `/api/v1/custody/*`, `/api/v1/admin/custody/*` |
| Notifications | `/api/v1/notifications/*` |
| AI | `/api/v1/ai/*` |
| Analytics | `/api/v1/analytics/*` |
| Observability | `/api/v1/observability/*`, `/api/v1/admin/observability/*` |
| Infrastructure | `/api/v1/admin/infrastructure/*` |

Exact paths and schemas: gateway Swagger + Nest controllers. Typed client: `@auvora/sdk` (`AuvoraClient`).

## Platform probes

| Path | Auth | Purpose |
|------|------|---------|
| `GET /health` | Public | Liveness |
| `GET /ready` | Public | Readiness (auth reachability) |
| `GET /metrics/resilience` | `x-internal-api-key` when `INTERNAL_API_KEY` set or `NODE_ENV=production` | Proxy resilience counters |
| `GET /api/docs` | Public (restrict in prod via ingress) | OpenAPI UI |

## SDK usage

```ts
import { AuvoraClient } from '@auvora/sdk';

const client = new AuvoraClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  timeoutMs: 30_000,
});
client.setAccessToken(accessToken);
await client.getHealth();
```

## Versioning

Public HTTP APIs are under `/api/v1`. Breaking changes require a new major version path or coordinated RC notes.
