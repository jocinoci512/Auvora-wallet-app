# 08 — Testing Report

## Automated this phase

- `@auvora/web` typecheck + lint — pass
- `@auvora/admin` typecheck + lint — pass

## Manual / journey verification (launch team)

| Journey                | Expected after Phase 9                         |
| ---------------------- | ---------------------------------------------- |
| Send complete          | “Preview complete”, no explorer fake tx        |
| Buy/Sell complete      | “Preview complete”, no charged/submitted claim |
| Devices revoke offline | Toast: preview only                            |
| Activity               | Sample banner visible                          |
| Biometrics toggle      | “Preferred / Not set”                          |
| Production build       | No AccessTokenPanel; no Support (demo) nav     |
| Crash                  | error boundary retry                           |

## Not covered here

E2E Playwright suite for live chain broadcast, provider KYC, admin SSO — required before GA (13).

## Offline

Existing offline helpers retained; Activity/Devices now honest when offline of API.
