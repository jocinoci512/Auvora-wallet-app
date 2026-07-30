# 05 — Accessibility Review

## Failures found

1. Section nav active state invisible (CSS) — keyboard users got no current-page cue beyond focus.
2. High contrast / reduce motion toggles were no-ops.
3. Notification filters used `role="tablist"` without tabpanels.
4. PIN inputs used `autoComplete="off"` instead of meaningful tokens.

## Fixes

- Tabs: `aria-current="page"` + visible active styles for anchors
- `html[data-high-contrast]` / `html[data-reduce-motion]` styles
- Notification filters → `role="group"` + `aria-pressed`
- PIN: `one-time-code` / `new-password`
- `.cx-sr-only` utility restored for label hiding

## Remaining

- Full keyboard model for Web3 Hub approve/reject
- NFT media captions / reduced-motion on gallery hover
- Prefer native confirm dialogs → accessible ConfirmSheet later

## Gate

Improved — major false a11y claims fixed. Full WCAG 2.2 AA audit still recommended before public launch.
