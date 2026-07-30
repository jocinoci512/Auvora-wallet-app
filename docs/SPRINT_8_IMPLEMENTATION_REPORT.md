# Sprint 8 Implementation Report

## Summary

Sprint 8 delivered a polished Settings, Notifications, and Personalization system — mobile-first with web parity. Settings are organized into searchable categories with short descriptions (not a flat switch list). Notifications and price alerts are preview-first (in-app inbox, local evaluation). Account remains single-wallet polish with preview multi-wallet inventory only.

## Locked decisions

- Notifications: in-app center + category toggles + local price-alert CRUD (no FCM/APNs/web push)
- Account: rename / public export / preview switch-archive — no second vault
- Localization: English UI + locale-aware currency/date/time formats; language-pack-ready

## Architecture

- **Mobile** `PreferencesController` (`apps/mobile/lib/preferences/`) owns theme, locale, wallet display, accessibility, notification toggles, inbox, price alerts, and account display fields in SharedPreferences (`auvora_user_prefs_v1`, alerts, inbox).
- **SecurityController** remains protection; **PortfolioController** keeps hide-balances; prefs bridge hide-zero.
- **Web** extends existing `/settings/*` with About, Networks, Price Alerts; notification vocabulary aligned to mobile purpose copy.

## What shipped

### Mobile

- Settings home with search and ten categories
- Account, Wallet, Notifications, Notification Center, Price Alerts, Appearance, Privacy, Networks, Accessibility, Help, About
- Theme drives `MaterialApp.themeMode`; text scale from accessibility prefs
- More tab → Settings + Notification center

### Web

- Settings home reorganized to same category vocabulary
- `/settings/about`, `/settings/networks`, `/settings/alerts`
- Notification toggles matched to mobile purposes
- Help FAQ updated for theme, push honesty, price-alert honesty

## Preference storage

| Surface                | Store                         |
| ---------------------- | ----------------------------- |
| Mobile blob            | `auvora_user_prefs_v1`        |
| Mobile alerts          | `auvora_price_alerts_v1`      |
| Mobile inbox           | `auvora_notif_inbox_v1`       |
| Web account/appearance | `auvora_account_prefs_v1`     |
| Web notifs             | `auvora_notif_prefs_local_v1` |
| Web alerts             | `auvora_price_alerts_v1`      |

Cross-device sync is out of scope; field names are aligned for a future sync seat.

## Notification framework

- Category catalog with explicit purpose strings (anti-noise)
- Disabled categories skip enqueue
- Price alerts evaluate against demo prices on demand
- Copy states preview / not push / not live markets

## Localization strategy

- `LocalePrefs`: language code, region, currency, date/time format, timezone
- UI strings remain English; formatters ready for packs without IA redesign

## Verification

- `flutter test test/preferences_controller_test.dart`
- `dart analyze` on preferences + settings UI
- Web `tsc --noEmit`

## Council hardening applied during build

- Every notification toggle has purpose copy
- Advanced network options behind disclosure
- Help FAQ searchable and short
- Settings search for &lt;10s findability
- Honest preview labeling throughout

## Known limitations

- No live push or live market alert evaluation
- No multi-wallet vault
- No full translation packs
- Screenshot protection is preference/hint, not OS enforcement on all platforms

## Recommended follow-up

- Push notification providers behind the same category catalog
- Live price feed for alert evaluation
- Multi-wallet vault when Account “Add wallet” graduates from preview
- Language packs (es, fr, …) using the locale framework
