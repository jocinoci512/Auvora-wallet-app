# Backup & Recovery Settings (Product UI)

**Task:** 033  
**Route:** `/settings/backup`  
**Component:** `BackupRecoverySettingsExperience`  
**Storage:** `auvora_backup_prefs_v1` (+ syncs reminder with security prefs)

> Infrastructure / database backup procedures live in [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md).

## Capabilities

| Capability             | Status                                 |
| ---------------------- | -------------------------------------- |
| Recovery phrase status | Verified / action needed               |
| Backup reminders       | Switch (also updates Task 029 prefs)   |
| Verification status    | Local mark verified                    |
| Education              | Alerts for phrase safety               |
| Recovery guidance      | Links to `/wallets/recovery` rehearsal |

Existing recovery rehearsal UI is unchanged — this page is the settings entry and status surface.
