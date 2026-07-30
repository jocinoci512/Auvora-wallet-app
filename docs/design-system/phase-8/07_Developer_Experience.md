# 07 — Developer Experience

## Structure

```
apps/admin          # Ops console (Next)
apps/web            # Consumer
packages/sdk        # Typed API client (extended in Phase 8)
packages/ui         # Shared components (admin overrides tokens locally)
services/*          # Domain Nest services
docs/design-system/phase-8/
```

## Phase 8 DX improvements

1. **SDK methods** for users, audit, feature flag update, maintenance — no hand-rolled fetch in pages.
2. **Shared section nav** (`section-nav.ts`) to keep Ops/Infra/Identity/Support links consistent.
3. **Support demo module** isolated (`support-demo.ts`) so future API wiring is a single swap.
4. **Docs pack** under `docs/design-system/phase-8/` indexing ops work for design + eng.

## Env & tooling

- Admin: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME` via `apps/admin/src/env.ts`.
- Prefer `.tools\pnpm\pnpm.exe` on Windows; PowerShell uses `;` not `&&`.
- Typecheck: `pnpm --filter @auvora/admin typecheck`, `pnpm --filter @auvora/sdk typecheck`.

## Testing / CI

- Existing Jest per package; admin uses `--passWithNoTests`.
- CI/CD notes unchanged — see `docs/CI_CD_GUIDE.md`.
- Phase 8 did not add E2E for new pages (JWT-gated); recommend smoke against staging with seeded admin.

## Consistency rules

- Live admin pages: real API or clear error/empty state.
- Preview domains: explicit “Demo data” alerts.
- Never invent parallel observability or RBAC systems.
