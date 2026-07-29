# dApp Platform

**Phase:** 26  
**Models:** `TrustedDapp`, `DappConnectionRequest`, `DappPermissionGrant`, `DappBrowserBookmark`, `DappActivityEvent`

## Features

- Connection requests (create / list / approve / reject)
- Trusted dApps + revocation
- Permission grants + editor API
- dApp browser visit + bookmarks
- Connection history (activity events)
- Permission-gated signing prepare (transaction, message, typed data)
- Multiple concurrent WalletConnect sessions behind approvals

## User API

Base: `/api/v1/connections`

| Method   | Path                           | Description                       |
| -------- | ------------------------------ | --------------------------------- |
| GET      | `/web3/status`                 | Platform capabilities             |
| GET/POST | `/dapps/requests`              | List / create connection requests |
| POST     | `/dapps/requests/:id/approve`  | Approve + optional trust          |
| POST     | `/dapps/requests/:id/reject`   | Reject                            |
| GET      | `/dapps/trusted`               | Trusted dApps                     |
| POST     | `/dapps/trusted/:id/revoke`    | Revoke trust + grants             |
| GET/POST | `/dapps/permissions`           | List / update grants              |
| GET      | `/dapps/browser/bookmarks`     | Bookmarks                         |
| POST     | `/dapps/browser/visit`         | Visit + upsert bookmark           |
| DELETE   | `/dapps/browser/bookmarks/:id` | Remove bookmark                   |
| GET      | `/dapps/activity`              | History                           |
| GET      | `/dapps/sessions/summary`      | Session / trust summary           |
| POST     | `/dapps/sign/prepare`          | Permission-gated sign preview     |

## Admin API

| Method | Path                                        | Description                                        |
| ------ | ------------------------------------------- | -------------------------------------------------- |
| GET    | `/api/v1/admin/connections/dapps/analytics` | Request status, grants, bookmarks, recent activity |
| GET    | `/api/v1/admin/connections/sessions`        | Includes dApp pending + trusted counts             |
| GET    | `/api/v1/admin/connections/workers`         | Worker monitoring                                  |

## UX surfaces

- **Web** (`/connections`): dApp browser, approval dialogs, permission editor, trusted list, history, signature preview
- **Admin** (`/connections`): connection / session dashboards, permission analytics, provider health, workers

## Approval flow

1. dApp (or user) creates a connection request with origin, networks, permissions, optional nonce.
2. User reviews pending request and approves with accounts (or rejects).
3. Platform creates + approves a WalletConnect-style session via the provider port.
4. Trusted dApp row is upserted (unless `trustDapp: false`).
5. Permission grants are synchronized for that origin.
6. Activity + analytics + notification events are emitted.

## Signing flow

1. `POST /dapps/sign/prepare` checks origin permission (`REQUEST_TRANSACTIONS` or `REQUEST_SIGNATURES`).
2. Provider prepares a safe preview (no raw secrets).
3. User confirms via `POST /sign/confirm`.
4. Signature verification flag is returned by the provider.
