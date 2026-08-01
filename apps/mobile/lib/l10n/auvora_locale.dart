import 'package:intl/intl.dart';

import '../preferences/models.dart';

/// Localization / formatting helpers.
///
/// UI copy remains English in Closed Beta. Language packs can map string keys
/// through [AuvoraStrings] without changing call sites. Formats honor [LocalePrefs].
class AuvoraLocale {
  AuvoraLocale(this.prefs);

  final LocalePrefs prefs;

  String get languageTag => '${prefs.languageCode}_${prefs.regionCode}';

  /// True when UI direction should be RTL for the selected language.
  bool get isRtl => const {'ar', 'he', 'fa', 'ur'}.contains(prefs.languageCode);

  String formatCurrency(num amount, {int fractionDigits = 2}) {
    final code = currencyCode(prefs.currency);
    try {
      return NumberFormat.currency(
        locale: _localeTag,
        symbol: _symbolFor(code),
        decimalDigits: fractionDigits,
      ).format(amount);
    } catch (_) {
      return '$code ${amount.toStringAsFixed(fractionDigits)}';
    }
  }

  String formatNumber(num value, {int? fractionDigits}) {
    try {
      final fmt = NumberFormat.decimalPattern(_localeTag);
      if (fractionDigits != null) {
        fmt.minimumFractionDigits = fractionDigits;
        fmt.maximumFractionDigits = fractionDigits;
      }
      return fmt.format(value);
    } catch (_) {
      return value.toString();
    }
  }

  String formatDate(DateTime value) {
    final local = value.toLocal();
    final pattern = switch (prefs.dateFormat) {
      DateFormatPreference.mdy => 'MMM d, y',
      DateFormatPreference.dmy => 'd MMM y',
      DateFormatPreference.ymd => 'y-MM-dd',
    };
    try {
      return DateFormat(pattern, _localeTag).format(local);
    } catch (_) {
      return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
    }
  }

  String formatTime(DateTime value) {
    final local = value.toLocal();
    final pattern = prefs.timeFormat == TimeFormatPreference.h24 ? 'HH:mm' : 'h:mm a';
    try {
      return DateFormat(pattern, _localeTag).format(local);
    } catch (_) {
      return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
    }
  }

  String formatDateTime(DateTime value) => '${formatDate(value)} · ${formatTime(value)}';

  String get _localeTag => '${prefs.languageCode}_${prefs.regionCode}';

  static String _symbolFor(String code) => switch (code) {
        'USD' => '\$',
        'EUR' => '€',
        'GBP' => '£',
        'JPY' => '¥',
        _ => '$code ',
      };
}

/// String catalog seam for future ARB / language packs.
///
/// Keys are stable; [lookup] returns English today and can later resolve
/// from generated localizations without rewriting widgets.
abstract final class AuvoraStrings {
  static const supportedLanguageCodes = <String>['en'];

  static const Map<String, String> en = {
    'settings.title': 'Settings',
    'settings.search_hint': 'Search settings',
    'appearance.theme': 'Theme',
    'appearance.accent': 'Accent color',
    'appearance.accent_hint': 'Lagoon is the brand accent. Custom accents are prepared for a later release.',
    'notifications.title': 'Notifications',
    'notifications.permission': 'Device notification permission',
    'notifications.permission_body':
        'Auvora uses an in-app inbox today. Granting OS permission prepares this device for future push delivery.',
    'help.title': 'Support',
    'help.search_hint': 'Search help',
    'search.hint': 'Assets, wallets, activity, settings, help…',
    'intelligence.onboarding_recovery': 'Your recovery phrase is the master key to your wallet.',
    'intelligence.receive_network': 'Always verify you’re sharing the correct network.',
    'intelligence.send_irreversible': 'This transaction cannot be reversed after confirmation.',
    'intelligence.stake_lock': 'Some staking providers require a lock period.',
    'intelligence.web3_disconnect': 'You can disconnect this application at any time.',
    'intelligence.security_updated': 'Your wallet protection has been updated.',
  };

  static String lookup(String key, {String languageCode = 'en'}) {
    // Future: switch (languageCode) { case 'es': return es[key] ?? en[key]!; ... }
    return en[key] ?? key;
  }
}

/// Languages the product can select once packs ship.
const kLanguagePackCatalog = <({String code, String label, bool ready})>[
  (code: 'en', label: 'English', ready: true),
  (code: 'es', label: 'Español', ready: false),
  (code: 'fr', label: 'Français', ready: false),
  (code: 'pt', label: 'Português', ready: false),
  (code: 'ar', label: 'العربية (RTL-ready)', ready: false),
];

/// True when [code] has a ready Alpha language pack (English only today).
bool isLanguagePackReady(String code) => AuvoraStrings.supportedLanguageCodes.contains(code);
