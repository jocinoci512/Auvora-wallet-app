# Design Updates — Task 028

**Status:** Implementation follows this design contract.

## Figma MCP status (Task 028)

Figma MCP (`plugin-figma-figma`) was **not available** in the Cursor session during Task 028 implementation. Design-first contract is captured in this document; sync checklist remains for when MCP reconnects to the canonical library:

https://www.figma.com/design/<YOUR_FIGMA_FILE_KEY>

Implementation stayed synchronized with the Phase 27 design system tokens and the layout wireframes below.

## Design principles

1. **Consumer wallet, not admin** — one calm composition; insight without clutter.
2. **Brand first** — Auvora teal + IBM Plex; semantic tokens only.
3. **Hierarchy** — Portfolio value is the hero metric; secondary KPIs sit beneath; widgets follow.
4. **Motion** — 120–280ms ease; hover lift ≤2px; balance count-up; chart draw-in; respect `prefers-reduced-motion`.
5. **Density** — Compact cards (padding 0.85–1.1rem); no oversized hero cards.

## Dashboard layout (desktop ≥1120px)

```
┌─────────────────────────────────────────────────────────────┐
│ Greeting · last sync                                         │
│ $ Portfolio value (count-up)     Today / Week / Month        │
├──────────────┬──────────────────────┬───────────────────────┤
│ Portfolio    │ Allocation (donut)   │ Quick actions (2×5)   │
│ sparkline    │                      │                       │
├──────────────┴──────────┬───────────┴───────────────────────┤
│ Top holdings            │ Recent transactions               │
├─────────────┬───────────┼─────────────┬─────────────────────┤
│ Movers      │ Watchlist │ Market      │ Wallet health       │
├─────────────┼───────────┼─────────────┼─────────────────────┤
│ Network     │ Alerts    │ NFT / Stake │ Bridge / Swap / dApp│
│             │           │             │ + Notifications     │
└─────────────┴───────────┴─────────────┴─────────────────────┘
```

## Portfolio layout

```
┌─────────────────────────────────────────────────────────────┐
│ Portfolio · filters (search / network / sort)                │
│ Total · multi-wallet · multi-network                         │
├──────────────────────────────┬──────────────────────────────┤
│ Performance chart            │ Allocation chart             │
├──────────────────────────────┴──────────────────────────────┤
│ Asset cards (expandable positions, P/L, sparkline)          │
└─────────────────────────────────────────────────────────────┘
```

## Responsive

| Breakpoint   | Behavior                                           |
| ------------ | -------------------------------------------------- |
| ≥1280 (wide) | 12-col grid; charts span 5+4; actions 3            |
| 900–1279     | 8-col; stack tertiary widgets                      |
| 640–899      | 4-col; hero metrics wrap; actions 2-col            |
| <640         | Single column; sticky quick-actions strip optional |

## Figma sync checklist (when MCP returns)

- [ ] Page: `Dashboard` — desktop frame 1440×900
- [ ] Page: `Portfolio` — desktop + mobile 390
- [ ] Components: `MetricHero`, `Sparkline`, `DonutAllocation`, `QuickAction`, `HoldingRow`, `AssetCard`
- [ ] Variables: reuse Auvora Color collection
- [ ] Code Connect: map to `apps/web/src/components/dashboard/*`

## Token usage

| Role         | Token                                      |
| ------------ | ------------------------------------------ |
| Primary CTA  | `--auvora-color-primary`                   |
| Surfaces     | `--auvora-color-surface` / `surface-solid` |
| Positive P/L | `--auvora-color-success`                   |
| Negative P/L | `--auvora-color-error`                     |
| Muted        | `--auvora-color-text-muted`                |
| Border       | `--auvora-color-border`                    |
