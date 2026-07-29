# Device Management

**Task:** 033  
**Route:** `/settings/devices`  
**Component:** `DeviceManagementExperience`

## Capabilities

| Capability                      | Status                                           |
| ------------------------------- | ------------------------------------------------ |
| Current device                  | Highlighted row                                  |
| Previously used devices         | List with trusted badge                          |
| Last login / platform / browser | Meta rows                                        |
| Approximate location            | Placeholder string when unavailable              |
| Session expiration              | Shown per session                                |
| Remote session logout           | `DELETE /api/v1/me/sessions/:id` or local remove |
| Logout all other devices        | Bulk revoke non-current                          |
| Auto-lock / idle timeout        | Writes `auvora_security_prefs_v1`                |

## Empty states

No devices / no sessions → EmptyState copy.
