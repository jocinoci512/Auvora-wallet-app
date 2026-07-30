# 07 — Team Scalability

## Goal

Prepare the monorepo so new engineers, designers, and operators can ship safely without tribal knowledge.

## Strengths

| Area              | Notes                                             |
| ----------------- | ------------------------------------------------- |
| Architecture      | Turborepo + `@auvora/*` packages; ADRs            |
| Coding standards  | Strict TS, ESLint, Prettier, Conventional Commits |
| Component library | `@auvora/ui` + Aether `cx-*` / PlatformShell      |
| Design phases     | `docs/design-system/phase-*` narrative history    |
| Ops docs          | RUNBOOKS, MONITORING, DR, CI/CD                   |
| Contributing      | `docs/CONTRIBUTING.md` + brand voice pointer      |

## Developer onboarding path (recommended)

1. Read README + ARCHITECTURE + CONTRIBUTING
2. Bootstrap (`pnpm install`, docker, migrate)
3. Skim Phase 9 Go/No-Go and Phase 10 README (launch stance)
4. Touch `@auvora/ui` + one PlatformShell screen before large features
5. Never invent parallel design systems

## Internal tooling

- Admin ops for users/flags/maintenance/health
- Status API for public honesty
- Feature flags for progressive delivery

## Repository hygiene

- Prefer packages over copy-paste
- Keep root markdown sprawl linked from DOCUMENTATION_INDEX
- Do not commit secrets or production `.env`

## Knowledge sharing

- ADRs for irreversible decisions
- Phase folders for executive/product narratives
- Runbooks for incidents — not Slack folklore

## Gate

**Maintainability / team scalability: Pass** for structure; continue pruning duplicate root reports and enforcing package boundaries as headcount grows.
