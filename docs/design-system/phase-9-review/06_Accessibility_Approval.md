# 06 — Accessibility Approval

## Decision: **CONDITIONAL APPROVAL** for closed-beta · **NOT APPROVED** for WCAG 2.2 AA public claim

| Criterion                                     | Status |
| --------------------------------------------- | ------ |
| Skip link + single main landmark              | Pass   |
| Focus / reduced motion (web + admin baseline) | Pass   |
| Calm error recovery                           | Pass   |
| Automated axe / Playwright a11y suite         | Open   |
| ConfirmSheet replacing `window.confirm`       | Open   |

## Accessibility stance

Ship beta with known confirm-dialog debt. Do not market “WCAG 2.2 AA certified” until CI suite passes.
