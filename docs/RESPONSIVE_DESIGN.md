# Responsive Design — Auvora Wallet (Task 034)

## Status

**Responsive Status: Complete across primary breakpoints**

## Verified layout classes

| Viewport                            | Intent                                                    |
| ----------------------------------- | --------------------------------------------------------- |
| Desktop (≥1200)                     | Full primary + secondary nav; centered 960–1120px content |
| Laptop (901–1199)                   | Same nav model; comfortable padding                       |
| Tablet / large tablet               | Fluid grids; foldable-friendly max-width unlock mid-range |
| Mobile portrait (≤900)              | Primary nav + More drawer; stacked page headers           |
| Mobile landscape (≤480 + landscape) | Compressed vertical rhythm                                |
| Ultra-wide (≥1600)                  | Slightly wider measure, no stretched chrome               |

## Eliminated / guarded

- Horizontal page scroll (`overflow-x: clip`)
- Sticky header safe-area inset top
- Clipped dialogs on small screens (bottom sheet)
- Misaligned nav link density via More panel

## Design tokens

Spacing, radius, color, and type continue to come from `@auvora/ui` — experience CSS only adds layout shells.

## Figma sync

Responsive behavior is code-owned; Figma frames remain contract references (Starter plan page limit). See `FIGMA_GUIDE.md`.
