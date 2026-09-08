# Auvora Sentry Observability & Telemetry Architecture

This document specifies the unified, production-grade Sentry integration architecture across all Auvora tiers:

- **Backend Services** (`Gateway`, `Auth`, `Wallet`, `Blockchain`, `Compliance`, `Notifications`, `Connections`, `Market Data`)
- **Web Customer Portal** (Next.js)
- **Admin Operations Portal** (Next.js)
- **Mobile Application** (Android & iOS Flutter)

---

## 1. Centralized Project & Environment Structure

Auvora uses **one centralized Sentry organization** with dedicated projects mapped by client execution boundary:

| Sentry Project Slug | Target Platforms / Services                                                            | Primary Error Types Captured                                                                                 |
| :------------------ | :------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| `auvora-backend`    | Gateway, Auth, Wallet, Blockchain, Compliance, Notifications, Connections, Market Data | Unexpected 5xx server exceptions, unhandled rejections, upstream provider timeouts (Alchemy, Resend, Stripe) |
| `auvora-web`        | Next.js Web App (`apps/web`)                                                           | Uncaught React render exceptions, client hydrate crashes, server action failures                             |
| `auvora-admin`      | Next.js Admin App (`apps/admin`)                                                       | Uncaught console exceptions, operator dashboard render failures                                              |
| `auvora-mobile`     | Android / iOS Flutter App (`apps/mobile`)                                              | Uncaught Flutter framework errors, platform plugin exceptions, startup crashes                               |

### Supported Environments

- `staging`: Deployed on staging infrastructure, testing releases, and internal acceptance QA.
- `production`: Deployed on live infrastructure (Railway, Vercel, production mobile builds).

---

## 2. Backend Sentry Instrumentation & Error Filtering

### Expected Client Errors vs Unexpected Infrastructure Errors

To prevent alert fatigue and preserve event quotas, backend telemetry explicitly distinguishes between expected routine validation errors and actionable system faults:

1. **Suppressed Errors (NOT sent to Sentry)**:
   - HTTP 4xx Client Errors (`400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `429 Too Many Requests`).
   - Domain errors: `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`.
   - Routine password mistypes, token expiry, expired verification codes.
2. **Captured Errors (SENT to Sentry)**:
   - HTTP 5xx Server Errors (`500 Internal Server Error`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout`).
   - Database connection pool exhaustion (`ECONNREFUSED`, PostgreSQL timeouts).
   - Redis cluster connection dropouts.
   - Upstream third-party provider failures:
     - Alchemy JSON-RPC 5xx errors or network timeouts.
     - Resend SMTP transport outages (e.g. `EHOSTUNREACH`).
     - Stripe Identity API outages or 5xx responses.
   - Uncaught `TypeError`, `ReferenceError`, and unhandled promise rejections.

---

## 3. Web & Admin Sentry Integration (Next.js)

### Integration Pattern

1. Next.js Error Boundaries (`apps/web/src/app/error.tsx` and `apps/admin/src/app/error.tsx`) capture client-side rendering failures.
2. Server component errors and API route exceptions are captured on the Node.js/Edge runtime.
3. Strict Privacy Boundaries:
   - Strip `Authorization` and `Cookie` headers from error events.
   - Strip query parameters that might carry one-time tokens (`?token=...`, `?key=...`).
   - Never attach KYC document buffers, identity images, or user passwords.

---

## 4. Mobile Sentry Integration (Flutter)

### Integration Pattern

1. Dual-Gate Activation via `IntegrationConfig`:
   - `SENTRY_DSN`: String passed via `--dart-define=SENTRY_DSN=...`
   - `SENTRY_ENABLED`: Boolean passed via `--dart-define=SENTRY_ENABLED=true`
   - Dual condition: `IntegrationConfig.sentryReady == true` only when BOTH are valid.
   - Default values: `sentryDsn = ''`, `sentryEnabled = false`. No telemetry leaves the phone by default.
2. **Hard Non-Custodial Vault Boundaries**:
   The Flutter Sentry `beforeSend` callback strictly enforces:
   - **NEVER** transmit private keys (`0x` followed by 64 hex characters).
   - **NEVER** transmit seed words / mnemonics (BIP-39 word lists).
   - **NEVER** transmit wallet PINs, biometric secrets, or vault encryption keys.
   - **NEVER** transmit clipboard contents.
   - **NEVER** transmit user passwords or access/refresh JWT tokens.
3. **Fail-Safe Startup Guarantee**:
   - Sentry initialization is wrapped in a fail-safe `try/catch`.
   - If Sentry initialization fails (e.g. bad DSN, DNS failure, platform limitation), the exception is logged locally and the mobile wallet continues to boot with 100% functionality. Telemetry failure NEVER prevents a user from accessing their wallet.

---

## 5. Centralized Telemetry Redaction Engine

All outbound telemetry is routed through the centralized redaction engine (`services/observability/src/domain/log-masking.ts`):

| Data Category        | Representative Pattern              | Redacted Form                        |
| :------------------- | :---------------------------------- | :----------------------------------- |
| **Email Address**    | `user@example.com`                  | `[REDACTED_EMAIL]` or `[REDACTED]`   |
| **Phone Number**     | `+1-555-867-5309`                   | `[REDACTED_PHONE]` or `[REDACTED]`   |
| **Password**         | `"password": "secret123"`           | `[REDACTED]`                         |
| **JWT**              | `eyJhbGciOi...`                     | `[REDACTED_JWT]` or `[REDACTED]`     |
| **Refresh Token**    | `"refreshToken": "rt_..."`          | `[REDACTED]`                         |
| **Mnemonic / Seed**  | 12/24 words (`abandon abandon...`)  | `[REDACTED]`                         |
| **Private Key**      | `0x` + 64 hex characters            | `[REDACTED_KEY]` or `[REDACTED]`     |
| **KYC Identity ID**  | `vs_...` / passport / selfie data   | `[REDACTED]`                         |
| **Provider API Key** | `alch_...` / `re_...` / `whsec_...` | `[REDACTED_API_KEY]` or `[REDACTED]` |
| **RPC Credential**   | `https://.../v2/<key>`              | `https://.../v2/[REDACTED_RPC_KEY]`  |

---

## 6. Sentry Release Metadata

All reported events attach standard release tags for source-map mapping and deployment tracing:

- `environment`: `production` or `staging`
- `service`: Service name (e.g., `gateway`, `auth`, `compliance`, `web`, `admin`, `mobile`)
- `release`: `auvora@<version>+<git-sha>` (e.g., `auvora@1.0.0+d7d6335`)
- `dist`: Android `versionCode` (e.g., `26`) or build timestamp.

---

## 7. Owner-Credential Placeholders (Environment Variables Only)

To activate Sentry in production, the owner configures the following environment variables. **No credentials or tokens are committed to source code.**

### Backend Services (Railway)

- `SENTRY_DSN`: Sentry client DSN for backend services.
- `SENTRY_ENVIRONMENT`: `production` (or `staging`).

### Frontend Web & Admin (Vercel)

- `NEXT_PUBLIC_SENTRY_DSN`: Public DSN for browser error tracking.
- `SENTRY_AUTH_TOKEN`: CI/deployment auth token for uploading production source maps.
- `SENTRY_ORG`: Sentry organization slug.
- `SENTRY_PROJECT`: Sentry project slug (`auvora-web` or `auvora-admin`).

### Mobile App (Android / iOS Build Pipeline)

- `--dart-define=SENTRY_DSN=https://...`
- `--dart-define=SENTRY_ENABLED=true`

---

## 8. Monitoring Fail-Safe Proof

As proven by the test suite in `services/observability/src/domain/sentry-telemetry.spec.ts`:

1. **Sentry Unavailable / DNS Outage**: Network calls fail silently in the background; application requests continue without delay.
2. **Sentry HTTP 429 (Rate Limit Exceeded)**: Events are dropped locally; no retries storm the server; no user disruption.
3. **Sentry HTTP 5xx (Ingest Downtime)**: Dropped cleanly at the transport layer.
4. **Circular Context or Uncaught Telemetry Errors**: Caught by internal boundary guard and logged without unhandled exceptions.
