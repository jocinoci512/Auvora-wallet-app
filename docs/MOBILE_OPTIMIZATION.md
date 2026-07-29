# Mobile Optimization — Auvora Wallet (Task 034)

## Status

**Mobile Status: Complete (production-ready polish)**

Shared chrome and experience shells are optimized for phones without regenerating feature surfaces from Tasks 028–033.

## Targets

| Concern                | Approach                                                                          |
| ---------------------- | --------------------------------------------------------------------------------- |
| Touch targets          | Nav links / More toggle / primary actions use ≥2.5–2.75rem height                 |
| Bottom-friendly chrome | Mobile dialogs become bottom sheets; toasts respect `safe-area-inset-*`           |
| Gesture / overflow     | `overflow-x: clip` on root; tables scroll inside containers                       |
| Navigation             | Primary destinations stay visible; remaining routes collapse into **More** ≤900px |
| Keyboard / forms       | Dialog `max-height` uses `dvh` + safe areas; overscroll containment               |
| Charts                 | Existing SVG charts scale with container width (portfolio / dashboard)            |
| Adaptive spacing       | `globals.css` + experience CSS breakpoints (480 / 768 / 900 / 1600)               |

## Breakpoints (web)

- **≤480px landscape** — tighter hero type + padding
- **≤768px** — stacked headers, safe-area page padding, touch-sized buttons
- **≤900px** — compact nav with More panel
- **≥901px** — primary + secondary nav link rows
- **≥1600px** — slightly wider page measure for ultra-wide

## Key files

- `apps/web/src/components/Nav.tsx`
- `apps/web/src/app/globals.css`
- `packages/ui/src/styles.css` (site-nav, dialogs, toast, reduce-motion)
- Experience CSS already present: `settings-experience.css`, `web3-experience.css`, etc.

## Foldable readiness

Layout uses fluid max-widths and flex/grid shells rather than fixed dual-pane locks, so tall tablet / foldable aspect ratios do not clip primary content.

## Figma

Aligns with master file tokens; no frame regeneration. See `FIGMA_GUIDE.md` (Task 034 polish note).
