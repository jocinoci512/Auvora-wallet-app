# 02 — UI Review

## Findings (pre-fix)

| Issue                                                                     | Severity |
| ------------------------------------------------------------------------- | -------- |
| `.cx-tabs` styled only `button`, nav used `Link` — active pills invisible | P0       |
| Settings/Web3 tab wrap created mobile “pill soup”                         | P1       |
| High contrast / reduce motion prefs wrote dataset but no CSS              | P0       |
| PIN page still on legacy `wx` shell                                       | P1       |
| Mixed `@auvora/ui` Button/Switch vs `cx-btn`/`cx-chip`                    | P1       |
| Design-system links leaked into product Settings/Help                     | P2       |
| Raw `PENDING` / `IN_APP` enums in notification list                       | P1       |

## Fixes applied

- Tabs style `a` + `button`; horizontal scroll; `aria-current="page"`
- `[data-high-contrast]` / `[data-reduce-motion]` CSS wired
- PIN & lock migrated to `PlatformShell`
- Notification statuses humanized (Unread / Read)
- Product copy: removed design-system / “placeholder” / designer-speak where found
- `cx-skeleton` utility added for loading chrome

## Still average (open)

- Full `@auvora/ui` → `cx-*` consolidation on Devices / Account / Web3
- NFT gallery still hybrid `nx-*` + PlatformShell
- Score ring is still “demo fintech” visually — refine later
