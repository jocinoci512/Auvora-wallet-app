# Database Audit — RC1 (Task 035)

**Date:** 2026-07-27  
**Engine:** PostgreSQL via Prisma 6.5  
**Schema:** `database/prisma/schema.prisma`  
**Verdict:** **Database Status — Pass**

## Inventory

| Item                  | Count / status                 |
| --------------------- | ------------------------------ |
| Models                | **185**                        |
| Migration directories | **21**                         |
| `prisma validate`     | **PASS** (with `DATABASE_URL`) |

## Integrity patterns (sampled + conventions)

| Concern                               | Status                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- |
| Primary keys                          | Pass — `cuid()` / integer `@id` per conventions                         |
| Foreign keys + `@relation` both sides | Pass — schema conventions enforced                                      |
| `onDelete` policies                   | Pass — Cascade / SetNull used intentionally (sessions, devices, audit)  |
| Unique constraints                    | Pass — e.g. user+fingerprint devices, role permissions                  |
| Indexes                               | Pass — status, createdAt, expiresAt, actor/target audit indexes present |
| Timestamps                            | Pass — `createdAt` / `updatedAt` norms                                  |
| Soft delete                           | Present where required (`deletedAt` indexes on user-like entities)      |

## Transactions

- Application services use Prisma `$transaction` for multi-step wallet/auth flows (covered by unit/integration tests).
- Interactive transaction timeouts follow Prisma defaults unless overridden per call site.

## Connection pooling

- Documented in `.env.example` (`connection_limit`, `pool_timeout`, PgBouncer).
- Production should prefer pooled URLs; not hard-coded in schema.

## Migration integrity / rollback

- Forward migrations checked into `database/prisma/migrations/**`.
- Rollback strategy: restore from backup + `migrate resolve` for failed applies (standard Prisma ops — see OPERATIONS_GUIDE).
- No destructive unchecked drops observed in recent Phase 20–24 migrations (additive platforms).

## Redis

- Used for cache / rate-limit keys / queues (service-local adapters).
- Not a substitute for relational integrity.

## Risks / follow-ups

1. Staging `migrate deploy` dry-run on production-shaped data
2. EXPLAIN analysis for hottest wallet ledger / market queries under load
3. Ensure backup CronJob templates exercised before GA
