# Architecture

Auvora Wallet is organized as a **modular monolith in development** with independently deployable services. Each bounded context owns its domain logic while sharing platform packages.

## Layers (hexagonal)

Every NestJS service follows the same folder structure:

```
services/<name>/src/
  domain/           # Entities, value objects, domain services
  application/      # Use cases and orchestration
  infrastructure/   # Adapters (logging, Redis, observability)
  presentation/     # HTTP controllers and DTOs
```

## Shared packages

| Package | Role |
|---------|------|
| `@auvora/types` | Cross-cutting TypeScript types and Result helpers |
| `@auvora/ui` | React design system primitives |
| `@auvora/sdk` | Typed HTTP client for platform APIs |
| `@auvora/database` | Prisma NestJS module |
| `@auvora/security` | Security headers and crypto helpers |
| `@auvora/config` | ESLint, Prettier, Jest, and TS configs |

## Services (ports)

| Service | Port | Phase |
|---------|------|-------|
| gateway | 4000 | 2+ |
| auth | 4001 | 2 |
| wallet | 3002 | 3 |
| blockchain | 3003 | 4 |
| payments | 3004 | 5 |
| compliance | 3005 | 6 |
| notifications | 3006 | 8 |
| analytics | 3007 | **Phase 10 — Analytics & BI** |
| ai | 3008 | **Phase 9 — Enterprise AI Platform** |
| custody | 3009 | 7 |

## Data

Prisma manages a single shared schema with additive migrations per phase. Phase 8 adds notification/template/webhook/queue models (`20260726020000_notification_platform`). Seed version **0.8.0**.

## Cross-service communication

- **Browser → Gateway → Service** for all public APIs (JWT).
- **Service → Service** only via internal HTTP + `x-internal-api-key` (never via workspace package imports).
- Gateway **denies** `/api/v1/internal/**` from the public edge.

Phase 6 example: payments optionally calls compliance `POST /api/v1/internal/compliance/fraud/check` when `COMPLIANCE_SERVICE_URL` is set.

Phase 7 example: blockchain optionally calls custody `POST /api/v1/internal/custody/sign` when `CUSTODY_SERVICE_URL` is set.

Phase 8 example: auth optionally sends mail via notifications `POST /api/v1/internal/notifications/send` when `NOTIFICATIONS_SERVICE_URL` is set.

## Dependency & integration docs

- [Dependency diagram](diagrams/dependency-graph.md)
- [Phase 6 integration report](INTEGRATION_REPORT_PHASE6.md)
- [Phase 7 integration report](INTEGRATION_REPORT_PHASE7.md)
- [Phase 8 integration report](INTEGRATION_REPORT_PHASE8.md)
- [Architecture decisions index](../ARCHITECTURE_DECISIONS.md)
- [ADR 0001 — Modular monolith](adr/0001-modular-monolith.md)
- [ADR 0002 — Compliance policy engine](adr/0002-compliance-policy-engine.md)
- [ADR 0003 — Compliance provider ports](adr/0003-compliance-provider-ports.md)
- [ADR 0004 — Custody provider ports](adr/0004-custody-provider-ports.md)
- [ADR 0005 — Centralized notifications](adr/0005-centralized-notifications.md)
- [Compliance API reference](api/COMPLIANCE.md)
- [Shared package TypeDoc](api/index.html)

## Observability

Services integrate **Pino** structured logging and optional **OpenTelemetry** tracing via OTLP. A local collector config lives in `infrastructure/monitoring/`.

## Deployment

- **Docker Compose** — Local Postgres 16 and Redis 7
- **Kubernetes** — Base manifests for the gateway with liveness/readiness probes
- **Terraform** — AWS VPC stub for future cloud provisioning
