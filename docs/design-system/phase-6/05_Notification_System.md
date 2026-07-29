# 05 — Notification System

**Inbox:** `/notifications` (`NotificationCenterExperience`)  
**Local prefs:** `/settings/notifications`  
**Server prefs:** `/notifications/preferences`  
**Webhooks:** `/notifications/webhooks` (ops)

## Categories

Transactions · Price · Security · Staking rewards · Market / product · Web3 · System

## Behavior

- Live list via SDK when authorized
- Curated demo fallback when unauthorized
- Category chips + mark read
- Local toggles include `stakingRewards`
- Deep links between Security alerts and prefs

## Code

- `NotificationCenterExperience.tsx`
- `NotificationSettingsExperience.tsx`
- `lib/settings/prefs.ts` (`NotificationPrefsLocal`)
