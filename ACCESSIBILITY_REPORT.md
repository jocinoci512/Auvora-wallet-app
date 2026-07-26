# Accessibility Report

**Audit date:** 2026-07-26  
**Scope:** Web + Admin App Router surfaces  
**Baseline smoke:** `scripts/perf/a11y-smoke.mjs` (lang, viewport, landmarks, nosniff)

## Accessibility score: **6.9 / 10**

Foundational document semantics are present (`lang="en"`, `<main>`, `<nav>`). This pass added skip links, focus-visible outlines, `aria-current` navigation, live regions for loading/save feedback, and stronger form error association on transfer. Full WCAG 2.2 AA still requires axe/Playwright coverage and keyboard audits of every admin list.

## Strengths

| Check | Status |
|-------|--------|
| `html[lang]` | Present |
| Primary `<nav aria-label="Primary">` | Present (updated) |
| Page content in `<main>` | Typical pattern |
| Skip to content link | **Added** |
| Focus-visible on links/inputs/buttons | **Added** |
| `role="alert"` / `role="status"` on feedback | Improved via `Alert` / `Skeleton` / token saved |
| Reduced-motion for skeleton shimmer | Honored |
| Security headers (nosniff, frame deny) | Present on Next configs |

## Findings

### Critical

None confirmed in static review.

### High

| ID | Finding | Status |
|----|---------|--------|
| A11Y-H1 | Top nav has many links; keyboard users must tab extensively on Admin | **Open** — consider disclosure/“More” |
| A11Y-H2 | Color-only status dots without text would fail; current lists include text status | **Pass** on reviewed pages |
| A11Y-H3 | JWT in `localStorage` increases XSS impact (security ∩ a11y of session UX) | **Open** (tracked in security debt) |

### Medium

| ID | Finding | Status |
|----|---------|--------|
| A11Y-M1 | Many pages used bare `<p role="alert">` without consistent structure | **Partial** — migrate to `Alert` |
| A11Y-M2 | Transfer inputs lacked `aria-invalid` / describedby | **Fixed** on transfer form |
| A11Y-M3 | Loading states not announced | **Fixed** on upgraded pages (`aria-live`) |
| A11Y-M4 | No dark mode / contrast theme for low-light preference | **Open** — light theme contrast is generally adequate on paper/ink |
| A11Y-M5 | Tables may lack `<caption>` / scope on complex admin grids | **Open** |
| A11Y-M6 | a11y smoke ≠ axe / screen-reader coverage | **Open** |

### Low

| ID | Finding |
|----|---------|
| A11Y-L1 | Brand text in nav is not a link to home |
| A11Y-L2 | Some empty list items (“Queue empty.”) are low-context |
| A11Y-L3 | Icon-only controls not used today (positive for labeling) |

## Keyboard & focus

| Flow | Assessment |
|------|------------|
| Skip link → main | Implemented |
| Nav links | Tab-able; current page marked `aria-current="page"` |
| Forms | Native controls; transfer validates before submit |
| Modals | N/A — none implemented |

## Screen reader notes

- Skeleton and LoadingBlock expose `role="status"` + polite live region.  
- Error `Alert` uses `role="alert"`.  
- Success/info alerts use `role="status"`.  
- Token “Saved” announces via `aria-live="polite"`.

## Contrast (spot check)

| Pair | Approx | Notes |
|------|--------|-------|
| Ink on paper | High | Primary text |
| Accent on paper | Pass for UI text | Brand links |
| Muted subtitle | Borderline for small text | Keep ≥0.95rem |
| Danger alert text `#912018` on `#fef3f2` | Pass | Errors |

## Testing recommendations

1. Add Playwright + axe-core to CI for web/admin home, wallets, transfer, ops.  
2. Manual NVDA/VoiceOver pass on wallet create + transfer.  
3. Expand `a11y-smoke.mjs` to assert skip-link and `main` id target.  
4. Audit every `data-table` for headers/`scope`.

## Fixes applied this pass

- Skip link + `#main-content` landmark target  
- Focus-visible rings  
- Nav `aria-label` + `aria-current`  
- Accessible loading/empty/error primitives  
- Transfer field errors with `aria-invalid` / `aria-describedby`  
- `prefers-reduced-motion` on skeletons
