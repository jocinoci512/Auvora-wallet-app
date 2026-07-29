# ADR 0011: Shared UX primitives for Web and Admin polish

- Status: Accepted
- Date: 2026-07-26
- Phase: 16 — Enterprise UX, UI & Product Polish

## Context

Web and Admin grew many domain screens with duplicated loading/error/empty patterns and forked CSS. Phase 15 introduced basic `Alert` / `EmptyState` / `Skeleton` primitives. Remaining list/dashboard surfaces still mixed one-off markup, which hurt consistency and accessibility.

## Decision

1. Extend `@auvora/ui` with presentation-only primitives: `PageHeader`, `AsyncStates`, `StatusBadge` (plus prior Alert/EmptyState/Skeleton).
2. Keep Next-specific navigation helpers (`Subnav`, collapsible token panel) in each app — do not couple the UI package to `next/navigation`.
3. Prefer incremental page adoption over regenerating screens; no public API or business-logic changes for polish.
4. Stay **light-theme-first** for RC; dark mode remains deferred (document, do not half-implement).
5. Expand `a11y-smoke.mjs` to assert skip-link and `#main-content` without claiming full WCAG coverage.

> **Supersession (Phase 27):** Dark mode is no longer deferred. `@auvora/ui` now ships light / dark / system theming with persistence. See `docs/THEMING.md` and `docs/DESIGN_SYSTEM.md`. Decision points 1–3 and 5 remain in force.

## Consequences

- Faster, safer UI consistency work across 90+ routes.
- Apps must keep importing `@auvora/ui/styles.css` for shared chrome (chat layout, metric cards, skip link, skeletons).
- Remaining debt: migrate remaining list pages to `AsyncStates`, Admin overflow nav, axe/Playwright CI, optional dark theme ADR later.
