# Security Center

**Task:** 033  
**Route:** `/settings`  
**Component:** `SecurityCenterExperience`  
**Styles:** `apps/web/src/app/settings-experience.css` (`.sc`)  
**Libs:** `lib/settings/{api,demo,prefs}.ts`

## Purpose

Unified Security Center with score, recommended actions, and deep links into devices, sessions, dApps, PIN, backup, and Web3 permissions. Does not replace `/security` (PIN & lock from Task 029).

## Features

| Feature                  | Status                                                                |
| ------------------------ | --------------------------------------------------------------------- |
| Overall security score   | Weighted factors (PIN, backup, biometrics, devices, dApps, reminders) |
| Recommended actions      | Incomplete factors with CTA links                                     |
| Device management        | `/settings/devices`                                                   |
| Active sessions          | Devices page `#sessions`                                              |
| Trusted devices          | Device list badges                                                    |
| Connected dApps          | `/settings/dapps` + Web3 permission center                            |
| Permission overview      | Link to `/web3/permissions`                                           |
| Security alerts          | Preview list + dismiss                                                |
| Recovery / backup status | Factors + `/settings/backup`                                          |
| Password/PIN status      | Reads `auvora_security_prefs_v1` · manage at `/security`              |
| Biometric status         | Architecture flag from security prefs                                 |

## API

- `GET /api/v1/me/sessions`, `/api/v1/me/devices`
- `GET /api/v1/connections/dapps/sessions/summary`
- Demo fallback when offline

## Related

- [`ACCOUNT_SETTINGS.md`](./ACCOUNT_SETTINGS.md)
- [`DEVICE_MANAGEMENT.md`](./DEVICE_MANAGEMENT.md)
- [`PRIVACY_CENTER.md`](./PRIVACY_CENTER.md)
- [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)
- [`SECURITY_UX.md`](./SECURITY_UX.md)
