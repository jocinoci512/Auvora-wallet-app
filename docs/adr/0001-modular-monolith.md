# ADR 0001: Modular Monolith with Service Boundaries

- **Status:** Accepted
- **Date:** 2026-07-25
- **Context:** Auvora Wallet needs rapid iteration early on while preserving the option to scale services independently.

## Decision

Organize the codebase as a **pnpm monorepo** with:

1. Shared packages for types, UI, SDK, database, and config
2. Nine NestJS services with explicit hexagonal folders
3. Three Next.js apps for user, admin, and documentation surfaces
4. A single Prisma schema with migration history

Services communicate over HTTP in development and can be deployed independently via Docker/Kubernetes.

## Consequences

**Positive**

- Clear ownership boundaries per service
- Shared tooling and types reduce drift
- Turbo orchestrates builds and tests efficiently

**Negative**

- More boilerplate than a single NestJS app
- Cross-service transactions require explicit design later

## Alternatives considered

- **Single NestJS monolith** — Simpler initially but harder to scale teams and deployments.
- **Full microservices from day one** — Premature without product validation.
