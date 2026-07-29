# Theming

## Modes

| Mode     | Behavior                                 |
| -------- | ---------------------------------------- |
| `light`  | Forces light semantic tokens             |
| `dark`   | Forces dark semantic tokens              |
| `system` | Follows `prefers-color-scheme` (default) |

Preference persists in `localStorage` under `auvora-theme`.

## CSS contract

- Light: `:root`, `[data-theme="light"]`, `.auvora-theme-light`
- Dark: `[data-theme="dark"]`, `.auvora-theme-dark`
- Runtime sets `data-theme` + `color-scheme` on `<html>`
- Atmosphere: `--auvora-bg-atmosphere` (subtle gradient; theme-aware)

Legacy aliases (`--auvora-ink`, `--auvora-paper`, `--auvora-accent`, …) map to semantic vars so existing pages theme without rewrites.

## React API

```tsx
import { ThemeProvider, useTheme, ThemeToggle } from '@auvora/ui';

<ThemeProvider defaultTheme="system">{children}</ThemeProvider>;

const { theme, resolvedTheme, setTheme, cycleTheme } = useTheme();
```

`ThemeToggle` cycles light → dark → system.

## App wiring

- `apps/web` and `apps/admin` wrap with `AppProviders` (`ThemeProvider` + `ToastProvider` + `TooltipProvider`).
- Inline bootstrap script in root layout applies theme before paint (reduces FOUC).
- Nav includes `ThemeToggle`.

## ADR note

Phase 27 **supersedes** the ADR 0011 decision to defer dark mode. Shared primitives remain in `@auvora/ui`; theming is now first-class with light / dark / system + persistence.
