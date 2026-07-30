# 03 — UX Review

## Friction found

| Flow           | Friction                                     | Resolution                           |
| -------------- | -------------------------------------------- | ------------------------------------ |
| Settings home  | Claimed searchable; wasn’t                   | Search filter on categories          |
| Backup         | One-tap “Mark verified” taught false safety  | Removed; rehearsal is the path       |
| Signing        | Offline approve still showed Approved        | Preview-only error; no false success |
| Devices        | Logout-all / revoke without confirm          | Confirm dialogs added                |
| PIN            | Disjoint `wx` page after Security Center CTA | PlatformShell migrate                |
| Notifications  | “Local prefs” vs “Server prefs” jargon       | Renamed Alert / Delivery settings    |
| Help           | Design-system as “product documentation”     | Removed; status + recovery remain    |
| Security score | Devices “reviewed” if count > 0              | Requires live session data           |

## Anxiety reducers

- Calmer Signing subtitle (no “premium” marketing on money screens)
- Backup education without stacked Alarm alerts
- Notification empty uses `cx-empty`
- Security Center loading skeleton while hydrating

## Remaining UX debt

- Account vs Preferences still duplicate locale fields
- Web3 Hub demo catalog tone (“Verified placeholder”) still present
- NFT toolbar density still high for beginners
