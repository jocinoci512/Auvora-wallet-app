# Auvora Design System

Code-first design system shipped as `@auvora/ui`. Apps consume semantic CSS tokens and React primitives; Figma is a downstream sync target (see [FIGMA_GUIDE.md](./FIGMA_GUIDE.md)).

## Principles

1. **Trust / clarity** — IBM Plex Sans + Mono, teal primary, restrained surfaces.
2. **Semantic tokens first** — components read CSS variables (`--auvora-color-*`), never hard-coded brand hex in new UI.
3. **Incremental adoption** — existing domain pages inherit theme via CSS; no Tailwind/shadcn rewrite.
4. **Accessible by default** — focus-visible rings, ARIA on overlays, Radix for complex widgets.
5. **Light + dark + system** — see [THEMING.md](./THEMING.md). Supersedes ADR 0011 dark-mode deferral.

## Package

| Path                         | Role                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `packages/ui/src/tokens.ts`  | Typed token maps + `cssVar()`                                |
| `packages/ui/src/styles.css` | Light/dark CSS contract + component + shared utility classes |
| `packages/ui/src/index.ts`   | Tree-shakeable named exports (tsup ESM/CJS)                  |
| `@auvora/ui/styles.css`      | Import once in app layouts                                   |

## Token groups

- **Color** — primary, secondary, success, warning, error, info, background, surface, border, text, muted, hover, pressed, disabled (+ legacy aliases `--auvora-ink`, `--auvora-accent`, …).
- **Typography** — display, h1–h6, body, caption, label, button, mono (JS map + `.auvora-type-*` helpers).
- **Space** — 4/8-based scale (`space` / `--auvora-space-*`).
- **Radius / elevation / z-index / motion** — minimal shadows; intentional durations only.

## Contrast (WCAG AA targets)

Approximate pairs verified for gallery QA (light / dark):

| Pair                     | Light                 | Dark                     |
| ------------------------ | --------------------- | ------------------------ |
| text on background       | `#0b1220` / `#f7f4ef` | `#e8e6e1` / `#0c1118`    |
| primary button label     | white / `#0f6e56`     | `#0b1220` / `#3dba9a`    |
| muted text on background | rgba ink 65% / paper  | rgba paper 68% / dark bg |
| error text on error-bg   | `#b42318` / `#fef3f2` | `#f97066` / `#2a1210`    |

Re-check any custom pairing in the `/design-system` gallery under both themes.

## Usage

```tsx
import { Button, ThemeProvider, PageHeader } from '@auvora/ui';
import '@auvora/ui/styles.css';
```

Wire `ThemeProvider` (and toast/tooltip providers) in app client providers. Prefer `AppShell` + `Container` for chrome; keep route lists app-local.

## Accessibility

- Skip link + `#main-content` landmark in app layouts.
- `:focus-visible` ring via `--auvora-focus-ring`.
- Dialog / Select / Tabs / Switch / Checkbox / Tooltip / Popover via Radix.
- `prefers-reduced-motion` disables skeleton/spinner animation.
- Smoke: `node scripts/perf/a11y-smoke.mjs` (theme attribute + landmarks).

## Performance

- Named exports + `tsup` externals for React/Radix/Lucide → tree-shakeable.
- CSS is a single stylesheet (`sideEffects` on CSS only).
- Fonts remain `next/font` (IBM Plex) to avoid FOIT.
- Gallery is a client page; no heavy chart library.

## Verification

- Web: `http://localhost:3000/design-system`
- Admin: `http://localhost:3001/design-system`
- Theme toggle in primary nav (both apps).

## Related docs

- [UI_COMPONENT_LIBRARY.md](./UI_COMPONENT_LIBRARY.md)
- [THEMING.md](./THEMING.md)
- [FIGMA_GUIDE.md](./FIGMA_GUIDE.md)
- ADR: `docs/adr/0011-shared-ux-primitives.md` (dark mode superseded by Phase 27)
