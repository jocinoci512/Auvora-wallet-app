# 02 — UI Polish Report

## Kept

- Aether Mist/Lagoon, Syne/Manrope/Source Serif, TransactionShell / PlatformShell
- Status badges, AsyncStates, EmptyState, Alert from `@auvora/ui`
- Admin Mist/Lagoon token overrides

## Improved

| Item                              | Change                                                 |
| --------------------------------- | ------------------------------------------------------ |
| Send/Buy/Sell success chrome      | Preview-complete language; no explorer for fake hashes |
| Web3 Hub verified icon            | “Catalog badge (not attestation)”                      |
| Single `<main id="main-content">` | Layout landmark; shells no longer `role="main"`        |
| Admin focus + reduced motion      | `globals.css` baseline                                 |
| Global `error.tsx`                | Calm retry (web + admin)                               |

## Remaining visual debt (non-blocking)

- Mixed `cx-*` / `dash-*` / `pf-*` on portfolio charts
- Older admin domains still use `page__header`
- ConfirmSheet vs `window.confirm` on some settings actions

No redesign performed — polish only.
