# 09 — Performance Report

## Goals

Fast first render, minimal onboard bundle, smooth step transitions.

## Approach

| Tactic                                            | Status                |
| ------------------------------------------------- | --------------------- |
| CSS-only illustrations (orbit SVG)                | Done — no raster hero |
| Single `onboarding.css` for create/import/welcome | Done                  |
| No heavy animation libraries                      | Done                  |
| Step panels mount one-at-a-time                   | Done                  |
| Lazy route chunks (Next app router)               | Natural per-route     |
| Fonts via `next/font` (Phase 2)                   | Shared                |

## Validation

- `pnpm --filter @auvora/web typecheck` — PASS
- `pnpm --filter @auvora/web lint` — PASS
- Production build — run with Phase 3 delivery

## Recommendations

1. Dynamic-import security/prefs panels if create bundle grows
2. Prefetch `/dashboard` on success step hover
3. Avoid storing phrase in `sessionStorage` (memory-only — already)
