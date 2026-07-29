# 07 — Personalization

**Surface:** `/settings/preferences` (`PreferencesExperience`)

## Controls

- Theme (system / light / dark) — syncs `user-prefs` + `auvora-theme` + `data-theme`
- Currency, language, default network
- Date / time formats
- Fiat display
- Hide balances (privacy mode)
- Compact portfolio
- Reduce motion / high contrast flags

## Stores

| Store                                 | Role                                 |
| ------------------------------------- | ------------------------------------ |
| `lib/settings/prefs.ts`               | AccountPrefs                         |
| `lib/wallet-experience/user-prefs.ts` | Theme, privacyMode, portfolioCompact |

Preferences is the product home for personalization; Nav theme toggle remains a shortcut.
