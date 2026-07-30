# 01 — Admin Platform

## Intent

Bring the admin console to customer-facing quality **without** inventing a second design language. Extend live API consoles; use Aether Mist/Lagoon chrome in `apps/admin` only.

## What existed

Broad route coverage (wallets, blockchain, payments, compliance, custody, notifications, analytics, AI, observability, infrastructure) with uneven polish. Overview was three CTAs. Several high-value auth/ops APIs had **no UI**.

## Implemented (Phase 8)

| Surface                        | Route                        | Mode                           |
| ------------------------------ | ---------------------------- | ------------------------------ |
| Operations overview            | `/`                          | Live ops + analytics compose   |
| Admin accounts                 | `/users`, `/users/[id]`      | Live auth admin API            |
| Security center                | `/security`                  | Live alerts (filtered)         |
| Audit logs                     | `/security/audit`            | Live `GET /api/v1/admin/audit` |
| Observability logs             | `/observability/logs`        | Live (fixes broken subnav)     |
| Maintenance                    | `/observability/maintenance` | Live list + create             |
| Feature flag toggles           | `/infrastructure/config`     | Live PATCH                     |
| System settings hub            | `/settings`                  | Links to existing controls     |
| Support queue / KB / templates | `/support/*`                 | **Demo-labeled** preview       |
| Aether chrome                  | `globals.css`                | Mist/Lagoon token overrides    |

## Nav IA

Primary nav now prioritizes **Overview, Users, Support, Security, Settings** alongside domain modules. Shared section links live in `apps/admin/src/lib/section-nav.ts` (`OPS_LINKS`, `INFRA_LINKS`, `IDENTITY_LINKS`, `SUPPORT_LINKS`).

## Patterns reused

- `PageHeader` + `Subnav` + `AsyncStates` + `StatusBadge` (wallets/alerts template)
- `AccessTokenPanel` + `createApiClient()` for local admin JWT (not production SSO)
- Metric cards from existing `metric-grid` styles

## Not redesigned

Swap/NFT/staking/bridge pages, compliance case workflows, and custody signing remain as prior functional consoles. Polish is incremental.

## Gaps

- Content Management System (marketing) — not built; Support KB is preview only
- Admin SSO / SSO-gated nav by permission — still paste-JWT for local ops
- Full Aether migration of `@auvora/ui` shared tokens — admin overrides only (web untouched)
