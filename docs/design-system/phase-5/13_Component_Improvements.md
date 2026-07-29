# 13 — Component Improvements

## Shared (improved, not forked)

| Component             | Change                                                            |
| --------------------- | ----------------------------------------------------------------- |
| `TransactionShell`    | Safer step index; expanded `humanizeError`                        |
| `CxProgressTrack`     | Bridge-specific stage labels supported by callers                 |
| `core-experience.css` | `cx-qr*`, activity timeline, badges, stronger reduced-motion      |
| `QrPanel`             | Migrated to Aether `cx-*` (no legacy `wx` / UI Button dependency) |
| `validation.ts`       | `isNameLikeRecipient`, `resolveNamePreview`, `explorerUrlFor`     |

## Surfaces upgraded

- Send — name resolve + network explorer
- Receive — QrPanel styling fixed
- Swap / Bridge — real failure paths
- Buy / Sell — reassure copy corrected
- Address Book — name-capable validation messaging
- Activity — full Aether migration

## Explicitly not duplicated

No new per-flow shells. No second design token set. Legacy `trading-experience.css` remains unused by Phase 5 modules.
