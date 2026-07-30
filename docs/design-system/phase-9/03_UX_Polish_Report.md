# 03 — UX Polish Report

## Friction reduced

1. **Anxiety from fake success** — users no longer believe money moved in preview
2. **Device revoke theater** — preview mode refuses to fake logout
3. **Biometrics expectation** — preference labeled; no false security
4. **Production token panel** — hidden so consumers don’t see ops paste-JWT
5. **Staking quiet demo** — always labeled when offline

## Journeys walked

| Journey         | Friction found      | Action             |
| --------------- | ------------------- | ------------------ |
| Send → Done     | False “Sent”        | Preview complete   |
| Buy/Sell → Done | False submitted     | Preview complete   |
| Devices revoke  | Fake success toast  | Block when `!live` |
| Activity browse | Looked live         | Sample banner      |
| Error crash     | No product boundary | `error.tsx`        |

## Wording

Prefer “Preview”, “Simulator”, “Sample”, “Preference” over “Confirmed”, “On its way”, “Enabled” when backends are absent.
