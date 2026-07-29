# Security Guide

**Version:** v1.0.0-rc.1  
**Related:** [`SECURITY_HARDENING.md`](./SECURITY_HARDENING.md), [`TECHNICAL_DEBT_REPORT.md`](../TECHNICAL_DEBT_REPORT.md)

## Authentication & sessions

- Auth service: argon2 passwords, JWT access tokens, hashed refresh tokens, device fingerprinting
- Refresh cookies: `httpOnly`; CSRF double-submit on cookie mutating routes
- Frontend RC pattern: Bearer token via `@auvora/sdk` (localStorage helper for admin/web demos — prefer httpOnly session in hardened prod deployments; see debt TD-M4)

## Authorization

- RBAC roles + fine-grained permission codes
- Nest `@Roles` / `@Permissions` on admin controllers
- Gateway strips internal headers; forwards correlation / trace IDs only

## API security

- Helmet + COOP/CORP/HSTS (prod) on gateway; aligned headers on Next apps
- Edge rate limit (`GATEWAY_RATE_LIMIT_*`)
- Proxy timeouts (`PROXY_TIMEOUT_MS`, default 30s)
- Input validation via Zod / class-validator DTOs
- `/metrics/resilience` requires `x-internal-api-key` when `INTERNAL_API_KEY` is set or in production

## Secrets & keys

- Runtime: `@auvora/secrets` factory (env / k8s / vault / cloud SM)
- Deploy: External Secrets Operator (non-local); chart Secret local-only
- Custody: private keys never leave custody boundary; field encryption adapters for sensitive columns

## Address validation (RC fix)

When `BLOCKCHAIN_SERVICE_URL` is unset, wallet uses **local format validation** and **rejects unknown chains** (fail-closed). When URL is set, validation is delegated to the blockchain service with a 5s timeout.

## Dependency & supply chain

- `pnpm audit --prod` — **0 critical** at RC; OpenTelemetry highs accepted with upgrade plan
- CI: gitleaks, dependency review, Trivy image scan, Cosign image signing workflows
- Overrides: nodemailer, sharp, postcss, js-yaml, major-scoped brace-expansion

## Accepted risks (signed for RC)

| Risk                                                            | Mitigation                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| OTEL auto-instrumentations / sdk-node / jaeger propagator highs | Health/ready independent of Prometheus exporter; upgrade train Phase 14 GA+ |
| brace-expansion advisory range FP on 1.1.16                     | Scoped overrides; do not global-pin 5.x onto ESLint                         |

## Container / infrastructure

- Non-root images, dropped capabilities, startup/liveness/readiness probes
- NetworkPolicy / Ingress TLS annotations in Helm
- See [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)
