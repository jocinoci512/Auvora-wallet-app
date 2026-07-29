# 02 — Settings Architecture

**Home:** `/settings` (`SettingsHomeExperience`)  
**Nav:** `SettingsSectionNav` (Aether `cx-tabs`)

## Categories

| Route                     | Purpose                        |
| ------------------------- | ------------------------------ |
| `/settings`               | Category index                 |
| `/settings/security`      | Security Center                |
| `/settings/account`       | Profile / locale               |
| `/settings/preferences`   | Appearance & personalization   |
| `/settings/notifications` | Alert toggles                  |
| `/settings/devices`       | Devices & sessions             |
| `/settings/dapps`         | Connected apps inventory       |
| `/settings/privacy`       | Privacy controls               |
| `/settings/backup`        | Recovery status                |
| `/settings/advanced`      | Developer / legal placeholders |
| `/settings/help`          | Help & support                 |

## Principles

- Clean, searchable category cards on home
- One PlatformShell chrome for all settings
- Security is a category — not overloaded as the settings home

## Code

- `SettingsHomeExperience.tsx` + category experiences under `components/settings/`
- Prefs: `lib/settings/prefs.ts`
