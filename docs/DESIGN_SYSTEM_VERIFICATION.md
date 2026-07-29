# Design System Verification

**Phase / Task:** Post-Task-027 (Phase 27 — Enterprise Design System & UI Foundation)  
**Date:** 2026-07-27  
**Repo:** `auvora-wallet`  
**Constraint:** Verification only — no new features.

## Gate results

| Gate                         | Command                                          | Status                |
| ---------------------------- | ------------------------------------------------ | --------------------- |
| Install                      | `pnpm install`                                   | PASS                  |
| Lint                         | `pnpm lint`                                      | PASS (35/35 packages) |
| Unit + package tests         | `pnpm test`                                      | PASS (35/35 packages) |
| Build                        | `pnpm build`                                     | PASS (29/29 packages) |
| Typecheck (UI / Web / Admin) | `pnpm --filter @auvora/{ui,web,admin} typecheck` | PASS                  |

> **Note:** Full turbo runs require `.tools/pnpm` on `PATH` so turbo can resolve the package manager binary.

## Design System Status

| Area                 | Status | Evidence                                                                                             |
| -------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| Package `@auvora/ui` | PASS   | Builds ESM/CJS + DTS via tsup; tests 8/8                                                             |
| Semantic tokens      | PASS   | `tokens.ts` + light/dark maps in `styles.css`; legacy aliases (`--auvora-ink`, `--auvora-accent`, …) |
| Theme runtime        | PASS   | `ThemeProvider` / `useTheme` / `ThemeToggle`; `localStorage` key `auvora-theme`                      |
| App wiring           | PASS   | Web/Admin `Providers` + FOUC script + `AppShell` + Nav toggle                                        |
| Gallery              | PASS   | `/design-system` on web + admin; included in production builds                                       |
| Shared CSS migration | PASS   | Panel/form/table/nav utilities in `@auvora/ui/styles.css`; thin app `globals.css`                    |

## Component Status

| Group         | Status       | Notes                                                                         |
| ------------- | ------------ | ----------------------------------------------------------------------------- |
| Actions       | PASS         | `Button` (incl. loading), `IconButton`, `Icon`                                |
| Forms         | PASS         | Input/Textarea/Field/Select/Checkbox/Radio/Switch (Radix)                     |
| Feedback      | PASS         | Alert, Badge, StatusBadge, Toast, Loader, Skeleton, Empty/Error/Success       |
| Overlays      | PASS         | Dialog, Drawer, Popover, Tooltip (Radix)                                      |
| Navigation    | PASS         | Tabs, Breadcrumbs, Pagination                                                 |
| Data / layout | PASS         | Card, Table, List, Avatar, ChartFrame, AppShell, Container, Stack, Grid, Page |
| Inventory     | ~40+ exports | See `docs/UI_COMPONENT_LIBRARY.md`                                            |

## Theme Status

| Mode            | Status                                            |
| --------------- | ------------------------------------------------- |
| `light`         | PASS — `:root` / `[data-theme=light]`             |
| `dark`          | PASS — `[data-theme=dark]` / `.auvora-theme-dark` |
| `system`        | PASS — `prefers-color-scheme` + listener          |
| Persistence     | PASS — `auvora-theme`                             |
| FOUC mitigation | PASS — inline bootstrap on `<html>`               |
| Legacy CSS vars | PASS — aliases map to semantic roles              |

## Accessibility Status

| Check                       | Status | Notes                                                                             |
| --------------------------- | ------ | --------------------------------------------------------------------------------- |
| Skip link + `#main-content` | PASS   | Both app layouts                                                                  |
| Focus-visible rings         | PASS   | `--auvora-focus-ring`                                                             |
| Complex widgets             | PASS   | Radix Dialog/Select/Tabs/Switch/Checkbox/Tooltip                                  |
| Reduced motion              | PASS   | Skeleton/spinner respect `prefers-reduced-motion`                                 |
| Contrast docs               | PASS   | Matrix in `docs/DESIGN_SYSTEM.md`                                                 |
| a11y smoke script           | READY  | `scripts/perf/a11y-smoke.mjs` asserts theme attr + DS URL (requires running apps) |

## Figma synchronization

| Item                        | Status                                                  |
| --------------------------- | ------------------------------------------------------- |
| Sync                        | **Partial**                                             |
| Canonical file              | https://www.figma.com/design/<YOUR_FIGMA_FILE_KEY>      |
| Light color variables       | Published                                               |
| Button variants             | Published                                               |
| Dark multi-mode variables   | Blocked (Starter 1-mode limit)                          |
| Full library + Code Connect | Pending                                                 |
| Duplicate draft file        | Archive any parallel drafts — prefer one canonical file |

Details: `docs/FIGMA_GUIDE.md`.

## Performance

| Check                   | Status                                            |
| ----------------------- | ------------------------------------------------- |
| Tree-shakeable UI build | PASS — named exports; React/Radix/Lucide external |
| CSS sideEffects         | PASS — CSS-only side effects                      |
| Font loading            | PASS — `next/font` IBM Plex unchanged             |
| Gallery weight          | PASS — no heavy chart library                     |

## Responsive layout

| Check                          | Status                                                       |
| ------------------------------ | ------------------------------------------------------------ |
| AppShell / sidebar breakpoints | PASS — styles include ≤900px / ≤768px rules                  |
| Nav overflow                   | PASS — horizontal scroll / wrap on shell nav                 |
| Domain pages                   | PASS — inherit tokens; not individually restyled (by design) |

## Verification URLs

| Surface          | URL                                 |
| ---------------- | ----------------------------------- |
| Web DS gallery   | http://localhost:3000/design-system |
| Admin DS gallery | http://localhost:3001/design-system |
| Web shell        | http://localhost:3000               |
| Admin shell      | http://localhost:3001               |

## Conclusion

Task 027 design-system deliverables verify clean under install/lint/test/build. Remaining work is non-blocking (Figma plan upgrade for dark modes + Code Connect; optional live a11y smoke against running servers).
