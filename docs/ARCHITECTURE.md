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

The foundation phase exposes **health endpoints only** (`/health`, `/ready`). Product APIs are added in later phases.

## Shared packages

| Package | Role |
|---------|------|
| `@auvora/types` | Cross-cutting TypeScript types and Result helpers |
| `@auvora/ui` | React design system primitives |
| `@auvora/sdk` | Typed HTTP client for platform APIs |
| `@auvora/database` | Prisma NestJS module |
| `@auvora/security` | Security headers and crypto helpers |
| `@auvora/config` | ESLint, Prettier, Jest, and TS configs |

## Data

Prisma manages a single `SchemaMeta` table for migration validation. Product models will extend the schema incrementally.

## Observability

Services integrate **Pino** structured logging and optional **OpenTelemetry** tracing via OTLP. A local collector config lives in `infrastructure/monitoring/`.

## Deployment

- **Docker Compose** — Local Postgres 16 and Redis 7
- **Kubernetes** — Base manifests for the gateway with liveness/readiness probes
- **Terraform** — AWS VPC stub for future cloud provisioning