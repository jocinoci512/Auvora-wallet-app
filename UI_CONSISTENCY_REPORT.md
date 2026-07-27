# UI Consistency Report

**Audit date:** 2026-07-26  
**Phase:** 16 — Enterprise UX, UI & Product Polish

## Consistency score: **8.0 / 10**

Shared primitives now cover the main chrome patterns (header, async states, badges, alerts, skeletons). App CSS forks remain, but missing layout classes from Phase 15 are present and UI package owns more cross-app styles (chat, metrics, page header).

## Standardized patterns

| Pattern | Standard |
|---------|----------|
| Page titles | `PageHeader` |
| Loading / error / empty | `AsyncStates` or Alert + EmptyState + Skeleton |
| Status pills | `StatusBadge` / `.status-badge--*` |
| Buttons | `@auvora/ui` `Button` variants |
| Section nav | `Subnav` + `.page__subnav` |
| Forms | `.form-card` / `.form-stack` / `.field` |
| Tables | `.data-table` inside `.table-scroll` |
| Metrics | `.metric-grid` / `.metric-card` (UI CSS) |

## Color / typography / spacing

- Tokens: ink / paper / accent / danger / warn / success (UI CSS variables)
- Fonts: IBM Plex Sans + Mono via `next/font`
- Radius: 6px controls / 10px cards
- Focus: 2px accent outline (`:focus-visible`)

## Dark / light

**Light only** (ADR 0011). No incomplete dark theme.

## Gaps remaining

1. Deduplicate web/admin `globals.css` into `@auvora/ui/styles.css`
2. Modal / Dialog / Toast primitives
3. Admin nav overflow (“More”)
4. Migrate remaining ~70 list pages to `AsyncStates`
5. Icon set + breadcrumbs component
