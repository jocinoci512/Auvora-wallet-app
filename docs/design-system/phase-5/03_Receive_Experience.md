# 03 — Receive Experience

**Surface:** `/receive` (`ReceiveExperience`)

## Display

- Network + token selectors
- Large QR via Aether `QrPanel` (`cx-qr*`)
- Address with Copy + Share
- Wrong-network warning
- Estimated confirmation times

## Component improvement

`QrPanel` no longer depends on legacy `wx-qr` / `@auvora/ui` buttons. It uses `core-experience.css` so Receive stays self-contained on the Phase 5 stylesheet.

## Guidance

Educational, calm copy — not alarmist. Incorrect networks are the primary loss vector and stay visually prominent without panic chrome.

## Code

- `apps/web/src/components/wallet/ReceiveExperience.tsx`
- `apps/web/src/components/wallet/QrPanel.tsx`
