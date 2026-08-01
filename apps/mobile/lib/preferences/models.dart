import 'package:flutter/material.dart';

enum AppThemePreference { system, light, dark }

/// Future custom accent support — Lagoon is the shipped brand accent.
enum AccentColorPreference { lagoon, slate, forest }

enum FiatCurrency { usd, eur, gbp, jpy }

enum DateFormatPreference { mdy, dmy, ymd }

enum TimeFormatPreference { h12, h24 }

enum AssetSortPreference { valueDesc, nameAsc, changeDesc, balanceDesc }

enum NotificationCategory {
  incomingTransactions,
  outgoingTransactions,
  pendingConfirmations,
  transactionConfirmations,
  failedTransactions,
  priceAlerts,
  largeBalanceChanges,
  securityAlerts,
  walletConnections,
  softwareUpdates,
  networkOutages,
}

enum PriceAlertKind { assetTarget, assetPercent, portfolioThreshold }

enum PriceAlertDirection { above, below, either }

@immutable
class NotificationCategoryInfo {
  const NotificationCategoryInfo({
    required this.id,
    required this.title,
    required this.purpose,
  });

  final NotificationCategory id;
  final String title;
  final String purpose;
}

const kNotificationCatalog = <NotificationCategoryInfo>[
  NotificationCategoryInfo(
    id: NotificationCategory.incomingTransactions,
    title: 'Incoming transactions',
    purpose: 'Know when funds or assets arrive in this wallet.',
  ),
  NotificationCategoryInfo(
    id: NotificationCategory.outgoingTransactions,
    title: 'Outgoing transactions',
    purpose: 'Confirm when you send from this device.',
  ),
  NotificationCategoryInfo(
    id: NotificationCategory.pendingConfirmations,
    title: 'Pending confirmations',
    purpose: 'Stay aware while a transfer is still confirming on-chain.',
  ),
  NotificationCategoryInfo(
    id: NotificationCategory.transactionConfirmations,
    title: 'Completed confirmations',
    purpose: 'Hear when a pending transfer finishes confirming.',
  ),
  NotificationCategoryInfo(
    id: NotificationCategory.failedTransactions,
    title: 'Failed transactions',
    purpose: 'Know when a send or dApp request fails so you can retry safely.',
  ),
  NotificationCategoryInfo(
    id: NotificationCategory.priceAlerts,
    title: 'Price alerts',
    purpose: 'Custom targets you create for assets or portfolio moves.',
  ),
  NotificationCategoryInfo(
    id: NotificationCategory.largeBalanceChanges,
    title: 'Large balance changes',
    purpose: 'Notable swings so unexpected movement is visible.',
  ),
  NotificationCategoryInfo(
    id: NotificationCategory.securityAlerts,
    title: 'Security alerts',
    purpose: 'Devices, sessions, and protection events that need attention.',
  ),
  NotificationCategoryInfo(
    id: NotificationCategory.walletConnections,
    title: 'Wallet connections',
    purpose: 'New dApp connections and permission changes.',
  ),
  NotificationCategoryInfo(
    id: NotificationCategory.softwareUpdates,
    title: 'Software updates',
    purpose: 'App releases and important product notes — not marketing spam.',
  ),
  NotificationCategoryInfo(
    id: NotificationCategory.networkOutages,
    title: 'Network outages',
    purpose: 'When a network you use looks degraded (preview health).',
  ),
];

@immutable
class PriceAlert {
  const PriceAlert({
    required this.id,
    required this.kind,
    required this.title,
    required this.assetSymbol,
    required this.threshold,
    required this.direction,
    required this.createdAt,
    this.paused = false,
    this.lastTriggeredAt,
  });

  final String id;
  final PriceAlertKind kind;
  final String title;
  final String assetSymbol;
  final double threshold;
  final PriceAlertDirection direction;
  final DateTime createdAt;
  final bool paused;
  final DateTime? lastTriggeredAt;

  PriceAlert copyWith({
    String? title,
    double? threshold,
    PriceAlertDirection? direction,
    bool? paused,
    DateTime? lastTriggeredAt,
  }) {
    return PriceAlert(
      id: id,
      kind: kind,
      title: title ?? this.title,
      assetSymbol: assetSymbol,
      threshold: threshold ?? this.threshold,
      direction: direction ?? this.direction,
      createdAt: createdAt,
      paused: paused ?? this.paused,
      lastTriggeredAt: lastTriggeredAt ?? this.lastTriggeredAt,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'kind': kind.name,
        'title': title,
        'assetSymbol': assetSymbol,
        'threshold': threshold,
        'direction': direction.name,
        'createdAt': createdAt.toIso8601String(),
        'paused': paused,
        'lastTriggeredAt': lastTriggeredAt?.toIso8601String(),
      };

  factory PriceAlert.fromJson(Map<String, dynamic> json) {
    return PriceAlert(
      id: json['id'] as String,
      kind: PriceAlertKind.values.firstWhere(
        (k) => k.name == json['kind'],
        orElse: () => PriceAlertKind.assetTarget,
      ),
      title: json['title'] as String,
      assetSymbol: json['assetSymbol'] as String,
      threshold: (json['threshold'] as num).toDouble(),
      direction: PriceAlertDirection.values.firstWhere(
        (d) => d.name == json['direction'],
        orElse: () => PriceAlertDirection.above,
      ),
      createdAt: DateTime.parse(json['createdAt'] as String),
      paused: json['paused'] == true,
      lastTriggeredAt: json['lastTriggeredAt'] == null
          ? null
          : DateTime.parse(json['lastTriggeredAt'] as String),
    );
  }
}

@immutable
class AppNotificationItem {
  const AppNotificationItem({
    required this.id,
    required this.category,
    required this.title,
    required this.body,
    required this.createdAt,
    this.read = false,
  });

  final String id;
  final NotificationCategory category;
  final String title;
  final String body;
  final DateTime createdAt;
  final bool read;

  AppNotificationItem copyWith({bool? read}) {
    return AppNotificationItem(
      id: id,
      category: category,
      title: title,
      body: body,
      createdAt: createdAt,
      read: read ?? this.read,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'category': category.name,
        'title': title,
        'body': body,
        'createdAt': createdAt.toIso8601String(),
        'read': read,
      };

  factory AppNotificationItem.fromJson(Map<String, dynamic> json) {
    return AppNotificationItem(
      id: json['id'] as String,
      category: NotificationCategory.values.firstWhere(
        (c) => c.name == json['category'],
        orElse: () => NotificationCategory.softwareUpdates,
      ),
      title: json['title'] as String,
      body: json['body'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      read: json['read'] == true,
    );
  }
}

@immutable
class WalletDisplayPrefs {
  const WalletDisplayPrefs({
    this.hideZeroBalances = false,
    this.hideSmallBalances = false,
    this.smallBalanceThreshold = 1.0,
    this.autoRefresh = true,
    this.showFiatBesideCrypto = true,
    this.assetSort = AssetSortPreference.valueDesc,
    this.defaultNetwork = 'ETHEREUM',
  });

  final bool hideZeroBalances;
  final bool hideSmallBalances;
  final double smallBalanceThreshold;
  final bool autoRefresh;
  final bool showFiatBesideCrypto;
  final AssetSortPreference assetSort;
  final String defaultNetwork;

  WalletDisplayPrefs copyWith({
    bool? hideZeroBalances,
    bool? hideSmallBalances,
    double? smallBalanceThreshold,
    bool? autoRefresh,
    bool? showFiatBesideCrypto,
    AssetSortPreference? assetSort,
    String? defaultNetwork,
  }) {
    return WalletDisplayPrefs(
      hideZeroBalances: hideZeroBalances ?? this.hideZeroBalances,
      hideSmallBalances: hideSmallBalances ?? this.hideSmallBalances,
      smallBalanceThreshold: smallBalanceThreshold ?? this.smallBalanceThreshold,
      autoRefresh: autoRefresh ?? this.autoRefresh,
      showFiatBesideCrypto: showFiatBesideCrypto ?? this.showFiatBesideCrypto,
      assetSort: assetSort ?? this.assetSort,
      defaultNetwork: defaultNetwork ?? this.defaultNetwork,
    );
  }

  Map<String, dynamic> toJson() => {
        'hideZeroBalances': hideZeroBalances,
        'hideSmallBalances': hideSmallBalances,
        'smallBalanceThreshold': smallBalanceThreshold,
        'autoRefresh': autoRefresh,
        'showFiatBesideCrypto': showFiatBesideCrypto,
        'assetSort': assetSort.name,
        'defaultNetwork': defaultNetwork,
      };

  factory WalletDisplayPrefs.fromJson(Map<String, dynamic> json) {
    return WalletDisplayPrefs(
      hideZeroBalances: json['hideZeroBalances'] == true,
      hideSmallBalances: json['hideSmallBalances'] == true,
      smallBalanceThreshold: (json['smallBalanceThreshold'] as num?)?.toDouble() ?? 1.0,
      autoRefresh: json['autoRefresh'] != false,
      showFiatBesideCrypto: json['showFiatBesideCrypto'] != false,
      assetSort: AssetSortPreference.values.firstWhere(
        (s) => s.name == json['assetSort'],
        orElse: () => AssetSortPreference.valueDesc,
      ),
      defaultNetwork: (json['defaultNetwork'] as String?) ?? 'ETHEREUM',
    );
  }
}

@immutable
class AccessibilityPrefs {
  const AccessibilityPrefs({
    this.textScale = 1.0,
    this.reduceMotion = false,
    this.highContrast = false,
    this.hapticsEnabled = true,
    this.largeTouchTargets = false,
  });

  final double textScale;
  final bool reduceMotion;
  final bool highContrast;
  final bool hapticsEnabled;
  final bool largeTouchTargets;

  AccessibilityPrefs copyWith({
    double? textScale,
    bool? reduceMotion,
    bool? highContrast,
    bool? hapticsEnabled,
    bool? largeTouchTargets,
  }) {
    return AccessibilityPrefs(
      textScale: textScale ?? this.textScale,
      reduceMotion: reduceMotion ?? this.reduceMotion,
      highContrast: highContrast ?? this.highContrast,
      hapticsEnabled: hapticsEnabled ?? this.hapticsEnabled,
      largeTouchTargets: largeTouchTargets ?? this.largeTouchTargets,
    );
  }

  Map<String, dynamic> toJson() => {
        'textScale': textScale,
        'reduceMotion': reduceMotion,
        'highContrast': highContrast,
        'hapticsEnabled': hapticsEnabled,
        'largeTouchTargets': largeTouchTargets,
      };

  factory AccessibilityPrefs.fromJson(Map<String, dynamic> json) {
    return AccessibilityPrefs(
      textScale: (json['textScale'] as num?)?.toDouble() ?? 1.0,
      reduceMotion: json['reduceMotion'] == true,
      highContrast: json['highContrast'] == true,
      hapticsEnabled: json['hapticsEnabled'] != false,
      largeTouchTargets: json['largeTouchTargets'] == true,
    );
  }
}

@immutable
class LocalePrefs {
  const LocalePrefs({
    this.languageCode = 'en',
    this.regionCode = 'US',
    this.currency = FiatCurrency.usd,
    this.dateFormat = DateFormatPreference.mdy,
    this.timeFormat = TimeFormatPreference.h12,
    this.timeZone = 'local',
  });

  final String languageCode;
  final String regionCode;
  final FiatCurrency currency;
  final DateFormatPreference dateFormat;
  final TimeFormatPreference timeFormat;
  final String timeZone;

  LocalePrefs copyWith({
    String? languageCode,
    String? regionCode,
    FiatCurrency? currency,
    DateFormatPreference? dateFormat,
    TimeFormatPreference? timeFormat,
    String? timeZone,
  }) {
    return LocalePrefs(
      languageCode: languageCode ?? this.languageCode,
      regionCode: regionCode ?? this.regionCode,
      currency: currency ?? this.currency,
      dateFormat: dateFormat ?? this.dateFormat,
      timeFormat: timeFormat ?? this.timeFormat,
      timeZone: timeZone ?? this.timeZone,
    );
  }

  Map<String, dynamic> toJson() => {
        'languageCode': languageCode,
        'regionCode': regionCode,
        'currency': currency.name,
        'dateFormat': dateFormat.name,
        'timeFormat': timeFormat.name,
        'timeZone': timeZone,
      };

  factory LocalePrefs.fromJson(Map<String, dynamic> json) {
    // Alpha: English UI only — ignore any persisted non-English language code.
    return LocalePrefs(
      languageCode: 'en',
      regionCode: (json['regionCode'] as String?) ?? 'US',
      currency: FiatCurrency.values.firstWhere(
        (c) => c.name == json['currency'],
        orElse: () => FiatCurrency.usd,
      ),
      dateFormat: DateFormatPreference.values.firstWhere(
        (d) => d.name == json['dateFormat'],
        orElse: () => DateFormatPreference.mdy,
      ),
      timeFormat: TimeFormatPreference.values.firstWhere(
        (t) => t.name == json['timeFormat'],
        orElse: () => TimeFormatPreference.h12,
      ),
      timeZone: (json['timeZone'] as String?) ?? 'local',
    );
  }
}

@immutable
class AccountPrefs {
  const AccountPrefs({
    this.displayName = 'Auvora user',
    this.walletNickname = 'Primary',
  });

  final String displayName;
  final String walletNickname;

  AccountPrefs copyWith({String? displayName, String? walletNickname}) {
    return AccountPrefs(
      displayName: displayName ?? this.displayName,
      walletNickname: walletNickname ?? this.walletNickname,
    );
  }

  Map<String, dynamic> toJson() => {
        'displayName': displayName,
        'walletNickname': walletNickname,
      };

  factory AccountPrefs.fromJson(Map<String, dynamic> json) {
    return AccountPrefs(
      displayName: (json['displayName'] as String?) ?? 'Auvora user',
      walletNickname: (json['walletNickname'] as String?) ?? 'Primary',
    );
  }
}

/// Preview-only inventory row — not a second vault.
@immutable
class PreviewWalletRow {
  const PreviewWalletRow({
    required this.id,
    required this.label,
    required this.addressHint,
    required this.active,
    this.archived = false,
  });

  final String id;
  final String label;
  final String addressHint;
  final bool active;
  final bool archived;
}

ThemeMode themeModeFor(AppThemePreference pref) => switch (pref) {
      AppThemePreference.system => ThemeMode.system,
      AppThemePreference.light => ThemeMode.light,
      AppThemePreference.dark => ThemeMode.dark,
    };

Color accentColorFor(AccentColorPreference pref) => switch (pref) {
      AccentColorPreference.lagoon => const Color(0xFF0E4F5C),
      AccentColorPreference.slate => const Color(0xFF3D4F5F),
      AccentColorPreference.forest => const Color(0xFF1F6B4A),
    };

String currencyCode(FiatCurrency c) => switch (c) {
      FiatCurrency.usd => 'USD',
      FiatCurrency.eur => 'EUR',
      FiatCurrency.gbp => 'GBP',
      FiatCurrency.jpy => 'JPY',
    };
