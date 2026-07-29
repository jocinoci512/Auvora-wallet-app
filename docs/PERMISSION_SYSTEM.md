# Permission System

**Phase:** 26  
**Enum:** `DappPermissionCode`  
**Model:** `DappPermissionGrant`

## Granular permissions

| Code                   | Meaning                                      |
| ---------------------- | -------------------------------------------- |
| `VIEW_ADDRESSES`       | View connected addresses                     |
| `VIEW_BALANCES`        | View balances                                |
| `REQUEST_SIGNATURES`   | Message / typed-data signing                 |
| `REQUEST_TRANSACTIONS` | Transaction signing                          |
| `NETWORK_SWITCH`       | Network switching                            |
| `SESSION_MANAGE`       | Session restore / terminate style operations |

Canonical list: `services/connections/src/domain/dapp-permissions.ts`

## Lifecycle

1. **Request** — permissions listed on `DappConnectionRequest.requestedPermissions`
2. **Grant** — on approve, upserted as `DappPermissionGrant` (`allowed: true`)
3. **Edit** — `POST /dapps/permissions` toggles `allowed` / `expiresAt`
4. **Expire** — session monitor sets `allowed: false` + `revokedAt` when `expiresAt` passes
5. **Revoke** — trusted dApp revoke clears all grants for that origin

## Isolation rules

- Grants are scoped to `(userId, origin, permission)` — unique constraint
- Origins are normalized to lowercase URL origin (`https://host`)
- Signing asserts the specific permission before calling the provider
- Bitcoin + `REQUEST_TRANSACTIONS` is rejected at approve and sign time

## Enforcement points

- `DappPlatformService.assertPermission`
- `DappPlatformService.prepareDappSign`
- `DappPlatformService.approveConnectionRequest` (read-only network checks)
- `ConnectionsPermissionDeniedError` → HTTP 403

## Analytics

Admin: `GET /api/v1/admin/connections/dapps/analytics` → `activePermissionGrants` and recent permission-related activity events.
