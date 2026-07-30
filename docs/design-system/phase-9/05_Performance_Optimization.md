# 05 — Performance Optimization

## Current posture

- App Router code-splitting by route
- Fonts: `display: swap`, selective preload
- Charts/client experiences are client components (expected)
- Offline cache helpers for portfolio demo

## Phase 9 changes

No heavy bundle work — trust fixes only. Performance debt remains tracked:

1. Run Lighthouse on production build before GA (target 95+ Performance/A11y)
2. Lazy-load chart modules if portfolio LCP regresses
3. Admin support/demo code excluded from prod nav (tiny win)

## Motion

Admin now respects `prefers-reduced-motion`. Web core-experience already did.

## Verdict

**Pass for preview.** Formal Lighthouse CI gate still required before public marketing claims (13).
