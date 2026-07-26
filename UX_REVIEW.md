# UX Review

**Audit date:** 2026-07-26  
**Scope:** Web app (`apps/web`, 27 routes) and Admin portal (`apps/admin`, 64 routes)  
**Design system:** `@auvora/ui` + duplicated app `globals.css`

## Executive summary

Both apps share a light cream/teal visual language and a horizontal primary nav, but UX maturity varies sharply by surface. Wallet flows are the most polished; later Ops/Infra/Analytics pages often used unstyled class names (`page__header`, `stack`, `form-stack`) and lacked loading/empty patterns. This pass added shared feedback primitives, route skeletons, skip links, current-nav indication, responsive nav, and upgraded representative high-traffic pages.

**UX score: 6.8 / 10** (was ~5.5 before fixes)

## Inventory

| App | Routes reviewed | Primary jobs |
|-----|----------------:|--------------|
| Web | 27 | Wallets, blockchain, payments, compliance, custody, notifications, analytics, AI, status |
| Admin | 64 | Same domains + observability + infrastructure |

## Strengths

- Consistent brand color tokens (`--auvora-*`) and IBM Plex typography (now loaded via `next/font`).
- Wallet list / create flows: clear headers, unauthorized guidance, retry on error.
- Shared `Button` variants (primary / secondary / ghost).
- Token panel for API access is discoverable (engineering UX).

## Critical UX findings

None blocking core navigation.

## High

| ID | Finding | Status |
|----|---------|--------|
| UX-H1 | Ops/Infra/Status used `page__*`, `stack`, `form-stack`, `alert--success` **without CSS** | **Fixed** — styles added to both apps |
| UX-H2 | No App Router `loading.tsx` / skeletons | **Fixed** — root `loading.tsx` + `@auvora/ui` `Skeleton` |
| UX-H3 | Dense top nav overflows on tablet/mobile | **Mitigated** — wrap + column breakpoint ≤768px |
| UX-H4 | Many list pages: plain “Loading…” / bare empty strings | **Partial** — wallets, status, ops upgraded; roll out remaining |

## Medium

| ID | Finding | Status |
|----|---------|--------|
| UX-M1 | Transfer form lacked client validation / field errors | **Fixed** on `/payments/transfer` |
| UX-M2 | Admin home still said “foundation… later phases” | **Fixed** — real CTAs |
| UX-M3 | Home CTAs were inert “Platform ready” buttons | **Fixed** — link to real sections |
| UX-M4 | No dark mode | **Open** — light-only by design today |
| UX-M5 | No shared dialog/modal/toast system | **Open** |
| UX-M6 | Charts essentially absent; metric cards text-only | **Open** — readable but not visual analytics |
| UX-M7 | Tables not consistently wrapped in horizontal scroll | **Partial** — `.table-scroll` utility added |

## Low

| ID | Finding |
|----|---------|
| UX-L1 | JWT token panel is prominent on every page (engineering affordance, not end-user polish) |
| UX-L2 | Subnav links lack active state beyond underline on hover |
| UX-L3 | Iconography minimal / absent (status dots only) |

## Forms

| Surface | Validation | Feedback | Consistency |
|---------|------------|----------|-------------|
| Create wallet | HTML `required` + select | Error alert | Good (`form-card` / `field`) |
| Transfer | Client rules + `aria-invalid` | Field errors + alert | Improved |
| Many admin filters | Mixed raw `<input>` | Often alert-only | Needs `form-stack`/`field` migration |

## Loading / empty / error

| Pattern | Before | After |
|---------|--------|-------|
| Route transition | Blank | Root `Skeleton` |
| Async fetch | Text or none | `LoadingBlock` + `Skeleton` on key pages |
| Empty | One-line text | `EmptyState` with optional CTA |
| Error | Mixed `p` / `div.alert` | `Alert` with tone + `role="alert"` |

## Responsive

| Breakpoint | Behavior |
|------------|----------|
| Desktop | Max-width 960px content; horizontal nav |
| ≤768px | Nav stacks; main padding reduced; page headers stack |
| Tables | Utility `.table-scroll` available — adopt on wide tables |

## Recommendations

1. Migrate remaining list pages to `Alert` / `EmptyState` / `Skeleton`.  
2. Introduce a compact overflow nav (“More”) for Admin’s 11 top links.  
3. Add toast/dialog primitives before adding destructive confirmations.  
4. Decide dark mode (explicit theme) or document light-only.  
5. Replace JWT panel with a proper login session UX for GA.
