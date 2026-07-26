# UI Consistency Report

**Audit date:** 2026-07-26  
**Apps:** `apps/web`, `apps/admin`  
**Shared kit:** `packages/ui`

## Consistency score: **7.2 / 10**

Visual language is recognizable across both apps, but CSS was forked and later pages drifted to class names that were never defined. Shared primitives in `@auvora/ui` now cover alerts, empty states, and skeletons; app globals were aligned for missing layout/form classes.

## Design tokens

| Token | Value | Usage |
|-------|-------|-------|
| Ink | `#0B1220` | Body text |
| Paper | `#F7F4EF` | Surface |
| Accent | `#0F6E56` | Brand / CTAs |
| Accent muted | `#D7EDE6` | Badges / hover |
| Border | `#D6D3CD` | Cards / inputs |
| Fonts | IBM Plex Sans / Mono | Loaded via `next/font` |

**Note:** App `globals.css` files remain duplicated (~90% overlap). Prefer moving shared layout CSS into `@auvora/ui/styles.css` next.

## Component inventory

| Component | Location | Notes |
|-----------|----------|-------|
| `Button` | `@auvora/ui` | primary / secondary / ghost |
| `Alert` | `@auvora/ui` | error / warn / success / info (**new**) |
| `EmptyState` | `@auvora/ui` | title / description / action (**new**) |
| `Skeleton` / `LoadingBlock` | `@auvora/ui` | route + inline loading (**new**) |
| `Nav` | per-app | aria-current + responsive wrap (**updated**) |
| `AccessTokenPanel` | per-app | identical twins |

**Missing system pieces:** Modal, Dialog, Toast, Tabs, DataTable, Icon, Pagination, Select (styled).

## Class / pattern consistency

| Pattern | Web | Admin | Status |
|---------|-----|-------|--------|
| `page-header` / `page-subtitle` | Yes | Yes | Consistent |
| `page__header` / `page__subnav` | Status | Ops/Infra | **Styled this pass** |
| `stack` lists | Status | Ops/Infra | **Styled this pass** |
| `form-card` / `field` | Wallet forms | Sparse | Prefer for all forms |
| `form-stack` | Transfer | — | **Styled this pass** |
| `wallet-card` / `metric-card` | Web wallets | Admin metrics | Parallel card language |
| `data-table` | Both | Both | Shared; wrap with `.table-scroll` |
| `alert--*` | Both | Both | Plus `@auvora/ui` `Alert` |

## Spacing & typography

- Main content: `max-width: 960px`, padding `2rem / 1.5rem` (reduced on mobile).
- H1 uses `clamp(2rem, 5vw, 2.75rem)` with tight letter-spacing.
- Body line-height 1.6; muted subtitle color consistent.
- Status badges use uppercase micro-type + pill radius.

## Buttons, badges, feedback

| Element | Consistency |
|---------|-------------|
| Buttons | Shared component — good |
| Status badges | Shared naming; admin has more status variants |
| Alerts | Dual path: CSS classes + new `Alert` component — migrate pages to component |
| Icons | Almost none — status `dot` only |
| Dialogs / modals | Not present |
| Notifications / toasts | Not present (token “Saved” is inline status) |

## Dark / light mode

**Light mode only.** No `prefers-color-scheme` theme or toggle. Surfaces assume cream paper background. Document as intentional for RC; add theme tokens before dark mode.

## Dashboards / charts / tables

| Surface | UI | Performance notes |
|---------|----|-------------------|
| Admin ops dashboard | Metric cards + stack list | Lightweight; no chart lib |
| Analytics pages | Mostly lists / text | No heavy chart rendering |
| Data tables | HTML tables | Fine at current sizes; add virtualization if rows grow |

## Fixes applied this pass

1. Extended `@auvora/ui` with Alert, EmptyState, Skeleton/LoadingBlock.  
2. Added missing CSS for `page__*`, `stack`, `form-stack`, success/info alerts, focus rings, mobile nav.  
3. Root `loading.tsx` skeletons for web + admin.  
4. Nav `aria-current` + skip link + IBM Plex via `next/font`.  
5. Polished home, wallets, transfer, status, ops dashboard pages.

## Remaining consistency work

1. Deduplicate web/admin `globals.css` into the UI package.  
2. Replace raw `alert alert--error` with `<Alert>` across admin lists.  
3. Standardize all forms on `field` / `form-stack`.  
4. Add overflow “More” menu for Admin nav.  
5. Introduce Modal + Toast when destructive admin actions land.
