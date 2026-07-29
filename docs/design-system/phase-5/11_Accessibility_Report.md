# 11 — Accessibility Report

## Target

WCAG 2.2 AA on core transaction surfaces.

## Patterns shipped

- Shell `role="main"`; step `progressbar` + `aria-current="step"`
- Progress track `aria-busy` + `aria-live="polite"`
- Focus-visible on fields, choices, buttons, timeline rows
- Touch targets via `.cx-btn` / `.cx-choice` / `.cx-chip`
- QR has visible address text alongside image
- Status not color-only (badge text)
- `prefers-reduced-motion` expanded to buttons, paths, keypad, timeline rows

## Follow-ups

- VoiceOver pass on Send keypad
- Live-region churn during Swap quote polling
- Dialog focus trap audit on QR / Address Book

## Gate: Accessibility Review — Pass (with follow-ups)
