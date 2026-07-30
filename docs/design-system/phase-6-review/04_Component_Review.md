# 04 — Component Review

## System

| Primitive                           | Role            | Status                                    |
| ----------------------------------- | --------------- | ----------------------------------------- |
| `PlatformShell`                     | Platform chrome | Strengthened (noopener on external links) |
| `TransactionShell`                  | Money verbs     | Unchanged (Phase 5)                       |
| `cx-tabs`                           | Section nav     | Fixed for Links                           |
| `cx-skeleton`                       | Loading         | Added                                     |
| `cx-empty` / `cx-alert` / `cx-warn` | States          | Prefer over mixed EmptyState long-term    |

## Duplicates / inconsistencies

| Pattern                               | Action                                   |
| ------------------------------------- | ---------------------------------------- |
| `@auvora/ui` Button wrapping `<Link>` | Prefer `cx-btn` as Link class            |
| EmptyState (ui) vs `cx-empty`         | Migrate remaining surfaces               |
| StatusBadge vs `cx-badge`             | Keep StatusBadge short-term; unify later |
| Dual `cx--wide` definitions           | Harmless; consolidate in CSS cleanup     |

## Rule going forward

New platform screens: **PlatformShell + cx-\*** only. Introduce `@auvora/ui` only when no Aether equivalent exists (dialogs, complex switches) — and document why.
