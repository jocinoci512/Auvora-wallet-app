# 08 — Accessibility Report

## Compliance target

WCAG 2.2 AA — Phase 1 `09_Accessibility.md`

## Implemented

| Requirement    | Evidence                                   |
| -------------- | ------------------------------------------ |
| Focus visible  | `ob-lumen` outlines on controls            |
| Touch targets  | ≥44–48px buttons, checkboxes rows          |
| Keyboard       | Native buttons/inputs; radiogroup patterns |
| Progress       | `role="progressbar"` with valuemin/max/now |
| Steps          | `aria-current="step"`                      |
| Live status    | Creating step `aria-live="polite"`         |
| Reduced motion | Spins/float/enter disabled                 |
| Labels         | Visible labels on fields                   |
| Reveal gate    | Phrase hidden until intentional reveal     |

## Follow-ups

- VoiceOver pass on phrase verification
- Ensure skip links land inside `.ob`
- High-contrast mode token bridge
- Announce security score changes to SR
