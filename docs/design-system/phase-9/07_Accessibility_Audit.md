# 07 — Accessibility Audit

## Met / improved

| Area           | Notes                                    |
| -------------- | ---------------------------------------- |
| Skip link      | Present in web + admin layouts           |
| Landmark       | Single `<main id="main-content">`        |
| Focus visible  | Admin baseline added                     |
| Reduced motion | Admin + existing web                     |
| Error recovery | `error.tsx` with calm copy               |
| Live regions   | Assistant already polite for latest line |
| Forms / steps  | TransactionShell steps retained          |

## Gaps remaining

1. Some `window.confirm` dialogs (not full AT dialogs)
2. Nested interactive patterns in older admin tables
3. Full WCAG 2.2 AA automated suite not run in this phase

## Verdict

**Pass for preview** with known confirm-dialog debt. Schedule axe/playwright a11y CI before GA.
