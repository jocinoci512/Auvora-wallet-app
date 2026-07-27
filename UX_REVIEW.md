# UX Review

**Audit date:** 2026-07-26  
**Phase:** 16 — Enterprise UX, UI & Product Polish  
**Scope:** Web (`apps/web`, 27 routes) + Admin (`apps/admin`, 64 routes)  
**Design system:** `@auvora/ui` + app chrome (`Subnav`, token panel)

## Executive summary

Phase 16 continued polish **without regenerating screens or changing APIs**. Shared presentation primitives (`PageHeader`, `AsyncStates`, `StatusBadge`) plus collapsible token chrome, AI chat layout, and upgraded wallets/payments/ops/alerts surfaces. Light theme remains intentional for RC.

**UX score: 7.6 / 10** (was 6.8 after Phase 15)

## Design improvements applied

| Area | Change |
|------|--------|
| Feedback | `AsyncStates` unifies loading / error / empty |
| Headers | `PageHeader` standardizes title, subtitle, actions |
| Status | `StatusBadge` normalizes pill modifiers |
| Navigation | `Subnav` with `aria-current`; primary nav current page |
| Token panel | Collapsed `<details>` to reduce visual noise |
| AI chat | Two-column chat layout, labeled feedback buttons |
| Tables | Scroll wrappers + captions on upgraded lists |
| A11y smoke | Asserts skip-link + `#main-content` |

## Components updated (`@auvora/ui`)

- `PageHeader`, `AsyncStates`, `StatusBadge` (new)
- `Alert`, `EmptyState`, `Skeleton`, `LoadingBlock`, `Button` (prior)
- Shared CSS: chat, metric cards, page header, skip link, skeletons

## Pages updated (this phase)

| App | Pages |
|-----|-------|
| Web | Home (prior), wallets, wallets/new, payments, payments/transfer (prior), AI chat, status (prior) |
| Admin | Home (prior), wallets, observability dashboard, alerts |
| Both | AccessTokenPanel, Nav (prior), layouts/loading (prior) |

Remaining list pages still use older alert markup — migrate incrementally via `AsyncStates`.

## Performance perception

- Root route `loading.tsx` skeletons retained
- Inline `Skeleton` / `LoadingBlock` on upgraded async screens
- No unsafe optimistic mutations; no API changes
- Metric cards remain lightweight (no heavy chart libs)

## Known issues

1. Admin top nav still dense on small screens (wrap only — no “More” menu yet)
2. Dark mode not implemented (light-only)
3. No modal/toast system yet
4. Many admin list pages not yet on `AsyncStates`
5. Charts remain text/metric-card based

## Verification URLs

- Web: http://localhost:3000  
- Admin: http://localhost:3001  
- API: http://localhost:4000 · Swagger `/api/docs` · Health `/health`
