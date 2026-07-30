# 04 — Component Consistency

## Canonical shells

| Shell                         | Use                                      |
| ----------------------------- | ---------------------------------------- |
| `TransactionShell`            | Money / stepped flows                    |
| `PlatformShell`               | Settings, Web3, NFT, insights, assistant |
| Admin `PageHeader` + `Subnav` | Ops / identity                           |

## Shared primitives to prefer

`Alert`, `AsyncStates`, `EmptyState`, `StatusBadge`, `Button`, `cx-alert`, `cx-btn`, `cx-panel`

## Inconsistencies accepted for launch preview

Portfolio still imports dashboard chart CSS — deliberate reuse, unify later.

## Landmark rule (Phase 9)

Layout owns `<main id="main-content">`. Shells are containers only.
