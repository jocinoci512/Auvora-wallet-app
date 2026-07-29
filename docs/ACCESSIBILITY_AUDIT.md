# Accessibility Audit — Auvora Wallet (Task 034)

## Status

**Accessibility Status: WCAG AA oriented — pass with continuous smoke**

## Checklist

| Requirement                                 | Status                                                 |
| ------------------------------------------- | ------------------------------------------------------ |
| Skip link → `#main-content`                 | Pass                                                   |
| `html[lang]` + runtime locale sync          | Pass (`LocaleDocumentSync`)                            |
| Viewport meta / `viewportFit: cover`        | Pass                                                   |
| Keyboard-focusable nav & controls           | Pass (native links/buttons)                            |
| `aria-current="page"` on nav                | Pass                                                   |
| Dialog focus trap                           | Pass (Radix Dialog)                                    |
| Live regions for offline / toasts           | Pass (`role="status"` banner + toast tones)            |
| Color tokens with light/dark semantic roles | Pass (design system)                                   |
| Reduced motion                              | Pass (`prefers-reduced-motion` + `data-reduce-motion`) |
| High contrast preference hook               | Pass (`data-high-contrast` from prefs)                 |
| Semantic landmarks                          | Pass (`nav`, `main` / `#main-content`)                 |
| Touch target size on mobile chrome          | Pass (≥44px class of targets)                          |

## Gaps / follow-ups

- Full axe CI suite across every experience route remains optional
- Some demo-only controls still lack long-form `aria-describedby` copy
- RTL is architected (`dir` from language) but translations are not shipped yet

## Smoke

```bash
node scripts/perf/a11y-smoke.mjs
```

Targets: `/`, `/design-system`, `/settings`, `/web3`, admin home.
