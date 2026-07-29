# Permission Center

**Task:** 032  
**Route:** `/web3/permissions`  
**Component:** `PermissionCenterExperience`

## Capabilities

| Capability                          | Status                                     |
| ----------------------------------- | ------------------------------------------ |
| Connected accounts                  | Distinct account KPI from grants           |
| Granted permissions                 | List with origin / network / permission    |
| Network permissions                 | Shown per grant row                        |
| Signature / transaction permissions | Risk chips (`low` / `medium` / `elevated`) |
| Revoke access                       | Live revoke POST or local remove           |
| Edit permissions                    | Deep-link to signing review                |
| Last activity                       | Timestamp per grant                        |

## API

- `GET /api/v1/connections/permissions`
- `POST /api/v1/connections/permissions/:id/revoke`
- Demo grants when offline

## Empty states

No grants → EmptyState guiding users back to the hub to approve a dApp.
