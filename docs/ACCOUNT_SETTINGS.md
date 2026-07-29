# Account Settings

**Task:** 033  
**Route:** `/settings/account`  
**Component:** `AccountSettingsExperience`  
**Storage:** `auvora_account_prefs_v1`

## Capabilities

| Capability                               | Status                                  |
| ---------------------------------------- | --------------------------------------- |
| Profile display name                     | Local + optional `PATCH /api/v1/me`     |
| Wallet nickname                          | Local                                   |
| Default wallet selection                 | Local select                            |
| Language / region / currency / time zone | Local (+ me PATCH when live)            |
| Notification preferences                 | Link to `/settings/notifications`       |
| Theme / appearance                       | Nav ThemeToggle + preferences deep link |

## Related

Preferences (formats, accessibility): `/settings/preferences`
