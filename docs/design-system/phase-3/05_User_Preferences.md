# 05 — User Preferences

## Scope (onboarding)

All optional. Defaults are production-safe.

| Preference        | Values            | Storage                |
| ----------------- | ----------------- | ---------------------- |
| Currency          | USD EUR GBP JPY   | `auvora_user_prefs_v1` |
| Theme             | system light dark | same                   |
| Default network   | network id        | same                   |
| Notifications     | bool              | same                   |
| Privacy mode      | hide balances     | same                   |
| Language          | `en` default      | same                   |
| Portfolio compact | bool              | same                   |

## API

`getUserPrefs` / `setUserPrefs` — `src/lib/wallet-experience/user-prefs.ts`

## UX

- “Use defaults” secondary action
- No forced questionnaire
- Prefs applied after security step on create; import applies network default

## Future

Wire theme preference to existing `auvora-theme` toggle; language to i18n pack when available.
