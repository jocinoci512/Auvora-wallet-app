# Accessibility Report

**Audit date:** 2026-07-26  
**Phase:** 16 — Enterprise UX, UI & Product Polish  
**Smoke:** `node scripts/perf/a11y-smoke.mjs` → **PASS** (web + admin)

## Accessibility score: **7.5 / 10**

Foundational landmarks and skip links are in place. Phase 16 improved labeled AI feedback controls, table captions/scope on upgraded pages, collapsible token panel (less keyboard noise when collapsed), and stronger async live regions via shared primitives.

## Smoke results (local)

| Target | Result |
|--------|--------|
| http://localhost:3000 | Pass — lang, viewport, skip-link, `#main-content`, nosniff |
| http://localhost:3001 | Pass — same |

## Improvements this phase

- Skip-link + main target already present; smoke now **requires** them
- `aria-current` on primary + section subnav
- AI feedback buttons use text + `aria-label` (not emoji-only)
- Chat message log uses `role="log"` + `aria-live="polite"`
- Admin wallet / payments tables: `<caption>`, `scope="col"`
- Token panel collapsed by default (fewer tab stops until opened)
- `prefers-reduced-motion` on skeletons retained

## Findings still open

| ID | Finding | Priority |
|----|---------|----------|
| A11Y-H1 | Admin nav tab count high | High |
| A11Y-M4 | No dark / forced-colors theme | Medium |
| A11Y-M5 | Many tables lack captions | Medium |
| A11Y-M6 | No axe/Playwright CI yet | Medium |
| A11Y-L1 | Brand text not a home link | Low |

## Keyboard

| Flow | Status |
|------|--------|
| Skip → main | Pass |
| Nav + current page | Pass |
| Forms (wallet create, transfer, AI send) | Pass on upgraded pages |
| Modals | N/A |

## Recommendation

Add Playwright + axe on home, wallets, payments, AI, ops before GA.
