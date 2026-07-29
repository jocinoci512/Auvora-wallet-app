# Phase 6 Integration Report — Compliance Platform

**Date:** 2026-07-25  
**Module:** `@auvora/compliance-service`  
**Verification:** Full workspace build / lint / typecheck / test — PASS (see `BUILD_STATUS.md`)

## 1. How compliance interacts with existing modules

```text
Browser (web :3000, admin :3001)
        │  JWT Bearer via @auvora/sdk
        ▼
  Gateway :4000
        │  proxy /api/v1/compliance/**
        │  proxy /api/v1/admin/compliance/**
        │  DENY /api/v1/internal/**
        ▼
  Compliance :3005 ──Prisma──▶ Postgres
        ▲
        │  x-internal-api-key
        │  POST .../fraud/check
        │  POST .../policy/evaluate
  Payments :3004 (optional COMPLIANCE_SERVICE_URL)
```

| Consumer                | Integration                                                               | Coupling                                       |
| ----------------------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| **Gateway**             | HTTP reverse proxy + OpenAPI stubs; `COMPLIANCE_SERVICE_URL`              | Config + path prefix only                      |
| **Payments**            | `FraudHookPort` → `ComplianceFraudHttpClient` or `NoopFraudHookAdapter`   | Optional HTTP; no workspace service dependency |
| **Auth**                | Unchanged; JWT/permissions issued with new `compliance:*` codes from seed | Shared RBAC codes in `@auvora/types` + DB      |
| **Wallet / Blockchain** | No direct calls in Phase 6                                                | None                                           |
| **Web / Admin**         | SDK methods → gateway                                                     | Additive UI routes                             |
| **Database**            | Shared Prisma schema; compliance tables owned by compliance domain        | Migration additive                             |
| **SDK / Types**         | New methods + `PermissionCode` literals                                   | Additive TypeScript surface                    |

## 2. Dependency boundaries (verified)

- No `*-service` → `*-service` workspace package edges.
- Apps depend only on `@auvora/sdk`, `@auvora/types`, `@auvora/ui`, `@auvora/config`.
- Shared packages respect layering: `types`/`ui` → `config`; `sdk`/`security` → `types`; `database` → `database-schema`.
- **No circular workspace dependencies.**
- **No relative import cycles** in compliance, payments, gateway, sdk, types, or database packages.

## 3. API contract compatibility

| Surface                                             | Change type                                | Breaking?                     |
| --------------------------------------------------- | ------------------------------------------ | ----------------------------- |
| Auth / Wallet / Blockchain / Payments public routes | Untouched                                  | No                            |
| Gateway public paths                                | New `/api/v1/compliance*` proxies          | No (additive)                 |
| Gateway internal deny list                          | Still blocks `/api/v1/internal/**`         | No                            |
| Payments env                                        | Optional `COMPLIANCE_SERVICE_URL`          | No (unset = prior noop allow) |
| `PermissionCode`                                    | New union members                          | No (additive)                 |
| SDK client                                          | New methods/types                          | No (additive)                 |
| Seed                                                | Version `0.6.0`, new perms/providers/rules | Additive data                 |

Explicit intentional behavior change (documented, not a silent break): when `COMPLIANCE_SERVICE_URL` **is** set and compliance is down, payments fraud checks **deny** (fail closed).

## 4. Data & security touchpoints

- Migration: `database/prisma/migrations/20260725210000_compliance_platform/`
- Encryption: `COMPLIANCE_FIELD_ENCRYPTION_KEY` (min 32 chars)
- Simulators: `COMPLIANCE_SIMULATOR_ENABLED` (default false; production boot fails if true)
- Internal auth: shared `INTERNAL_API_KEY` (min 32) on compliance internal controllers

## 5. Residual risks (not blockers for Phase 6 completion)

- Wallet does not yet call policy evaluate on ledger mutations (payments is the primary money path wired).
- Real vendor adapters not implemented (ports + simulators/unavailable stubs only).
- Access tokens remain in `localStorage` (pre-existing); JWT denylist not uniformly applied across all services.

## 6. Artifacts

| Artifact                 | Path                                       |
| ------------------------ | ------------------------------------------ |
| Build status             | `BUILD_STATUS.md`                          |
| Changelog                | `CHANGELOG.md`                             |
| ADR index                | `ARCHITECTURE_DECISIONS.md`                |
| ADRs                     | `docs/adr/0002-*.md`, `docs/adr/0003-*.md` |
| Dependency diagram       | `docs/diagrams/dependency-graph.md`        |
| Compliance API reference | `docs/api/COMPLIANCE.md`                   |
| Shared package TypeDoc   | `docs/api/` (HTML)                         |
| Architecture overview    | `docs/ARCHITECTURE.md`                     |
