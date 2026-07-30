# Contributing

Thank you for contributing to Auvora Wallet.

## Development workflow

1. Fork and clone the repository.
2. Run `pnpm install` and `node scripts/bootstrap.mjs`.
3. Start infrastructure: `docker compose up -d`.
4. Generate and migrate the database: `pnpm db:generate && pnpm db:migrate`.
5. Create a feature branch from `develop`.
6. Make changes with tests.
7. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before opening a PR.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/). Husky runs `lint-staged` on pre-commit and `commitlint` on commit-msg.

Examples:

- `feat(wallet): add balance query port`
- `fix(gateway): correct health uptime calculation`
- `chore(deps): bump nestjs to 11.0.12`

## Code style

- TypeScript strict mode everywhere
- ESLint + Prettier enforced via lint-staged
- Prefer `@auvora/*` workspace packages over duplicated logic
- No `any` — use proper types or `unknown` with narrowing
- Product copy: follow `apps/web/src/lib/brand/voice.ts` (calm, honest; never “guaranteed returns” / fake settlement language)
- Design phases live under `docs/design-system/` — Phase 10 is company readiness; do not treat it as a flip of the Phase 9 executive **NO GO** for public GA

## Pull requests

- Keep PRs focused and reviewable
- Include a test plan in the PR description
- Ensure CI passes (lint, typecheck, test, build)
