# 11 — Performance Report

## Strategy

- Client-side insight/health computation over already-loaded demo holdings (O(n log n) sorts; n small).
- `useMemo` only where lists derive from holdings (portfolio / insights) — matches existing repo patterns.
- Assistant history capped to last 40 messages in localStorage.
- Chat list `max-height` + overflow to avoid unbounded layout growth.
- No new heavy chart libraries; reuse existing Donut/Line charts.
- `/ai` redirect avoids dual AI page bundles for consumer path.

## Bundle impact

New routes are code-split by App Router page boundaries. Shared `lib/insights/demo.ts` is light (KB-scale strings + pure functions).

## Risks

- Portfolio still imports `dashboard.css` for `pf-card` / dash charts — acceptable reuse; unify under `cx-*` later if desired.
- Expanding LEARN_TOPICS with rich media should stay lazy (images on demand).

## Verdict

**Pass** for Phase 7 preview performance.
