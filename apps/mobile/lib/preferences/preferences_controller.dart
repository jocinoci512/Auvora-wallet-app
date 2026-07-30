import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../portfolio/portfolio_controller.dart';
import 'models.dart';

class PreferencesController extends ChangeNotifier {
  SharedPreferences? _prefs;
  PortfolioController? _portfolio;
  bool loading = true;

  AppThemePreference theme = AppThemePreference.system;
  AccountPrefs account = const AccountPrefs();
  LocalePrefs locale = const LocalePrefs();
  WalletDisplayPrefs walletDisplay = const WalletDisplayPrefs();
  AccessibilityPrefs accessibility = const AccessibilityPrefs();
  Map<NotificationCategory, bool> notificationToggles = {
    for (final c in NotificationCategory.values) c: true,
  };
  List<PriceAlert> priceAlerts = const [];
  List<AppNotificationItem> inbox = const [];
  List<PreviewWalletRow> previewWallets = const [];
  bool analyticsEnabled = false;
  bool crashReportingEnabled = false;
  bool requireAuthToRevealBalances = false;
  bool clearClipboardAfterCopy = true;
  bool screenshotProtectionHint = false;
  DateTime? networkCacheResetAt;

  static const _kBlob = 'auvora_user_prefs_v1';
  static const _kAlerts = 'auvora_price_alerts_v1';
  static const _kInbox = 'auvora_notif_inbox_v1';

  /// Demo prices for preview alert evaluation (not live market data).
  static const Map<String, double> kDemoPrices = {
    'BTC': 64250,
    'ETH': 3420,
    'SOL': 148,
    'PORTFOLIO': 12540,
  };

  void attachPortfolio(PortfolioController portfolio) {
    _portfolio = portfolio;
  }

  ThemeMode get materialThemeMode => themeModeFor(theme);

  int get unreadCount => inbox.where((n) => !n.read).length;

  Future<void> bootstrap() async {
    if (!loading) return;
    _prefs ??= await SharedPreferences.getInstance();
    _readBlob();
    priceAlerts = _readList(_kAlerts, PriceAlert.fromJson);
    inbox = _readList(_kInbox, AppNotificationItem.fromJson);
    if (previewWallets.isEmpty) {
      previewWallets = _seedPreviewWallets();
    }
    if (inbox.isEmpty) {
      inbox = _seedInbox();
      await _persistInbox();
    }
    if (priceAlerts.isEmpty) {
      priceAlerts = _seedAlerts();
      await _persistAlerts();
    }
    _syncPortfolioBridges();
    loading = false;
    notifyListeners();
  }

  // --- Account ------------------------------------------------------------

  Future<void> setDisplayName(String value) async {
    account = account.copyWith(displayName: value.trim().isEmpty ? 'Auvora user' : value.trim());
    await _persistBlob();
    notifyListeners();
  }

  Future<void> setWalletNickname(String value) async {
    account = account.copyWith(walletNickname: value.trim().isEmpty ? 'Primary' : value.trim());
    previewWallets = [
      for (final w in previewWallets)
        if (w.active)
          PreviewWalletRow(
            id: w.id,
            label: account.walletNickname,
            addressHint: w.addressHint,
            active: true,
            archived: w.archived,
          )
        else
          w,
    ];
    await _persistBlob();
    notifyListeners();
  }

  Future<void> setActivePreviewWallet(String id) async {
    previewWallets = [
      for (final w in previewWallets)
        PreviewWalletRow(
          id: w.id,
          label: w.label,
          addressHint: w.addressHint,
          active: w.id == id,
          archived: w.archived,
        ),
    ];
    final active = previewWallets.firstWhere((w) => w.id == id);
    account = account.copyWith(walletNickname: active.label);
    await _persistBlob();
    notifyListeners();
  }

  Future<void> archivePreviewWallet(String id) async {
    if (previewWallets.where((w) => !w.archived).length <= 1) return;
    previewWallets = [
      for (final w in previewWallets)
        if (w.id == id)
          PreviewWalletRow(
            id: w.id,
            label: w.label,
            addressHint: w.addressHint,
            active: false,
            archived: true,
          )
        else
          w,
    ];
    if (!previewWallets.any((w) => w.active && !w.archived)) {
      final first = previewWallets.firstWhere((w) => !w.archived);
      await setActivePreviewWallet(first.id);
      return;
    }
    await _persistBlob();
    notifyListeners();
  }

  // --- Appearance / locale / wallet / a11y --------------------------------

  Future<void> setTheme(AppThemePreference value) async {
    theme = value;
    await _persistBlob();
    notifyListeners();
  }

  Future<void> setLocale(LocalePrefs value) async {
    locale = value;
    await _persistBlob();
    notifyListeners();
  }

  Future<void> setWalletDisplay(WalletDisplayPrefs value) async {
    walletDisplay = value;
    _syncPortfolioBridges();
    await _persistBlob();
    notifyListeners();
  }

  Future<void> setAccessibility(AccessibilityPrefs value) async {
    accessibility = value;
    await _persistBlob();
    notifyListeners();
  }

  Future<void> setAnalyticsEnabled(bool value) async {
    analyticsEnabled = value;
    await _persistBlob();
    notifyListeners();
  }

  Future<void> setCrashReportingEnabled(bool value) async {
    crashReportingEnabled = value;
    await _persistBlob();
    notifyListeners();
  }

  Future<void> setRequireAuthToRevealBalances(bool value) async {
    requireAuthToRevealBalances = value;
    await _persistBlob();
    notifyListeners();
  }

  Future<void> setClearClipboardAfterCopy(bool value) async {
    clearClipboardAfterCopy = value;
    await _persistBlob();
    notifyListeners();
  }

  Future<void> setScreenshotProtectionHint(bool value) async {
    screenshotProtectionHint = value;
    await _persistBlob();
    notifyListeners();
  }

  Future<void> resetNetworkCache() async {
    networkCacheResetAt = DateTime.now();
    await _persistBlob();
    await enqueueNotification(
      category: NotificationCategory.networkOutages,
      title: 'Network cache reset',
      body: 'Preview RPC cache cleared on this device.',
    );
    notifyListeners();
  }

  // --- Notifications ------------------------------------------------------

  Future<void> setNotificationEnabled(NotificationCategory category, bool enabled) async {
    notificationToggles = {...notificationToggles, category: enabled};
    await _persistBlob();
    notifyListeners();
  }

  bool isNotificationEnabled(NotificationCategory category) =>
      notificationToggles[category] ?? true;

  Future<void> enqueueNotification({
    required NotificationCategory category,
    required String title,
    required String body,
  }) async {
    if (!isNotificationEnabled(category)) return;
    inbox = [
      AppNotificationItem(
        id: 'n-${DateTime.now().microsecondsSinceEpoch}',
        category: category,
        title: title,
        body: body,
        createdAt: DateTime.now(),
      ),
      ...inbox,
    ];
    await _persistInbox();
    notifyListeners();
  }

  Future<void> markRead(String id) async {
    inbox = [for (final n in inbox) n.id == id ? n.copyWith(read: true) : n];
    await _persistInbox();
    notifyListeners();
  }

  Future<void> markAllRead() async {
    inbox = [for (final n in inbox) n.copyWith(read: true)];
    await _persistInbox();
    notifyListeners();
  }

  List<AppNotificationItem> filteredInbox({NotificationCategory? category, String query = ''}) {
    final q = query.trim().toLowerCase();
    return [
      for (final n in inbox)
        if ((category == null || n.category == category) &&
            (q.isEmpty ||
                n.title.toLowerCase().contains(q) ||
                n.body.toLowerCase().contains(q)))
          n,
    ];
  }

  // --- Price alerts -------------------------------------------------------

  Future<PriceAlert> createPriceAlert({
    required PriceAlertKind kind,
    required String assetSymbol,
    required double threshold,
    required PriceAlertDirection direction,
    String? title,
  }) async {
    final symbol = assetSymbol.toUpperCase();
    final alert = PriceAlert(
      id: 'pa-${DateTime.now().microsecondsSinceEpoch}',
      kind: kind,
      title: title?.trim().isNotEmpty == true
          ? title!.trim()
          : _defaultAlertTitle(kind, symbol, threshold, direction),
      assetSymbol: symbol,
      threshold: threshold,
      direction: direction,
      createdAt: DateTime.now(),
    );
    priceAlerts = [alert, ...priceAlerts];
    await _persistAlerts();
    notifyListeners();
    return alert;
  }

  Future<void> updatePriceAlert(PriceAlert alert) async {
    priceAlerts = [for (final a in priceAlerts) a.id == alert.id ? alert : a];
    await _persistAlerts();
    notifyListeners();
  }

  Future<void> pausePriceAlert(String id, {required bool paused}) async {
    priceAlerts = [
      for (final a in priceAlerts) a.id == id ? a.copyWith(paused: paused) : a,
    ];
    await _persistAlerts();
    notifyListeners();
  }

  Future<void> deletePriceAlert(String id) async {
    priceAlerts = priceAlerts.where((a) => a.id != id).toList();
    await _persistAlerts();
    notifyListeners();
  }

  /// Evaluate alerts against demo prices — preview only, not live markets.
  Future<int> evaluatePriceAlerts() async {
    if (!isNotificationEnabled(NotificationCategory.priceAlerts)) return 0;
    var fired = 0;
    final next = <PriceAlert>[];
    for (final alert in priceAlerts) {
      if (alert.paused) {
        next.add(alert);
        continue;
      }
      final price = kDemoPrices[alert.assetSymbol] ?? kDemoPrices['ETH']!;
      final hit = switch (alert.kind) {
        PriceAlertKind.assetTarget || PriceAlertKind.portfolioThreshold =>
          _directionHit(price, alert.threshold, alert.direction),
        PriceAlertKind.assetPercent =>
          _directionHit(((price - alert.threshold).abs() / alert.threshold) * 100, 5, PriceAlertDirection.above),
      };
      if (hit) {
        fired++;
        next.add(alert.copyWith(lastTriggeredAt: DateTime.now()));
        await enqueueNotification(
          category: NotificationCategory.priceAlerts,
          title: alert.title,
          body:
              '${alert.assetSymbol} preview price \$${_fmt(price)} met your ${alert.threshold} threshold. Not live market data.',
        );
      } else {
        next.add(alert);
      }
    }
    priceAlerts = next;
    await _persistAlerts();
    notifyListeners();
    return fired;
  }

  // --- Persistence --------------------------------------------------------

  void _syncPortfolioBridges() {
    final p = _portfolio;
    if (p == null) return;
    if (p.hideZeroBalances != walletDisplay.hideZeroBalances) {
      p.setHideZero(walletDisplay.hideZeroBalances);
    }
  }

  Future<void> _persistBlob() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(
      _kBlob,
      jsonEncode({
        'theme': theme.name,
        'account': account.toJson(),
        'locale': locale.toJson(),
        'walletDisplay': walletDisplay.toJson(),
        'accessibility': accessibility.toJson(),
        'notificationToggles': {
          for (final e in notificationToggles.entries) e.key.name: e.value,
        },
        'analyticsEnabled': analyticsEnabled,
        'crashReportingEnabled': crashReportingEnabled,
        'requireAuthToRevealBalances': requireAuthToRevealBalances,
        'clearClipboardAfterCopy': clearClipboardAfterCopy,
        'screenshotProtectionHint': screenshotProtectionHint,
        'networkCacheResetAt': networkCacheResetAt?.toIso8601String(),
        'previewWallets': [
          for (final w in previewWallets)
            {
              'id': w.id,
              'label': w.label,
              'addressHint': w.addressHint,
              'active': w.active,
              'archived': w.archived,
            },
        ],
      }),
    );
  }

  void _readBlob() {
    final raw = _prefs!.getString(_kBlob);
    if (raw == null) return;
    try {
      final data = jsonDecode(raw) as Map<String, dynamic>;
      theme = AppThemePreference.values.firstWhere(
        (t) => t.name == data['theme'],
        orElse: () => AppThemePreference.system,
      );
      account = AccountPrefs.fromJson(Map<String, dynamic>.from(data['account'] as Map? ?? const {}));
      locale = LocalePrefs.fromJson(Map<String, dynamic>.from(data['locale'] as Map? ?? const {}));
      walletDisplay =
          WalletDisplayPrefs.fromJson(Map<String, dynamic>.from(data['walletDisplay'] as Map? ?? const {}));
      accessibility =
          AccessibilityPrefs.fromJson(Map<String, dynamic>.from(data['accessibility'] as Map? ?? const {}));
      final toggles = Map<String, dynamic>.from(data['notificationToggles'] as Map? ?? const {});
      notificationToggles = {
        for (final c in NotificationCategory.values) c: toggles[c.name] != false,
      };
      analyticsEnabled = data['analyticsEnabled'] == true;
      crashReportingEnabled = data['crashReportingEnabled'] == true;
      requireAuthToRevealBalances = data['requireAuthToRevealBalances'] == true;
      clearClipboardAfterCopy = data['clearClipboardAfterCopy'] != false;
      screenshotProtectionHint = data['screenshotProtectionHint'] == true;
      networkCacheResetAt = data['networkCacheResetAt'] == null
          ? null
          : DateTime.tryParse(data['networkCacheResetAt'] as String);
      final wallets = data['previewWallets'] as List<dynamic>?;
      if (wallets != null && wallets.isNotEmpty) {
        previewWallets = [
          for (final item in wallets)
            PreviewWalletRow(
              id: item['id'] as String,
              label: item['label'] as String,
              addressHint: item['addressHint'] as String,
              active: item['active'] == true,
              archived: item['archived'] == true,
            ),
        ];
      }
    } catch (_) {
      /* keep defaults */
    }
  }

  Future<void> _persistAlerts() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_kAlerts, jsonEncode([for (final a in priceAlerts) a.toJson()]));
  }

  Future<void> _persistInbox() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_kInbox, jsonEncode([for (final n in inbox) n.toJson()]));
  }

  List<T> _readList<T>(String key, T Function(Map<String, dynamic>) fromJson) {
    final raw = _prefs!.getString(key);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return [
        for (final item in list) fromJson(Map<String, dynamic>.from(item as Map)),
      ];
    } catch (_) {
      return const [];
    }
  }

  List<PreviewWalletRow> _seedPreviewWallets() => [
        PreviewWalletRow(
          id: 'w-primary',
          label: account.walletNickname,
          addressHint: '0x1111…1111',
          active: true,
        ),
        const PreviewWalletRow(
          id: 'w-trading',
          label: 'Trading (preview)',
          addressHint: '0x2222…2222',
          active: false,
        ),
      ];

  List<AppNotificationItem> _seedInbox() {
    final now = DateTime.now();
    return [
      AppNotificationItem(
        id: 'seed-sec',
        category: NotificationCategory.securityAlerts,
        title: 'Security checkup available',
        body: 'Review recovery and devices in Security Center when you have a moment.',
        createdAt: now.subtract(const Duration(hours: 5)),
      ),
      AppNotificationItem(
        id: 'seed-tx',
        category: NotificationCategory.incomingTransactions,
        title: 'Incoming transfer confirmed (preview)',
        body: '0.05 ETH credited in preview activity — not a live chain event.',
        createdAt: now.subtract(const Duration(days: 1)),
        read: true,
      ),
    ];
  }

  List<PriceAlert> _seedAlerts() => [
        PriceAlert(
          id: 'seed-btc',
          kind: PriceAlertKind.assetTarget,
          title: 'BTC above \$70,000',
          assetSymbol: 'BTC',
          threshold: 70000,
          direction: PriceAlertDirection.above,
          createdAt: DateTime.now().subtract(const Duration(days: 3)),
        ),
      ];

  String _defaultAlertTitle(
    PriceAlertKind kind,
    String symbol,
    double threshold,
    PriceAlertDirection direction,
  ) {
    return switch (kind) {
      PriceAlertKind.assetTarget =>
        '$symbol ${direction.name} \$${_fmt(threshold)}',
      PriceAlertKind.assetPercent => '$symbol moves ${threshold.toStringAsFixed(0)}%',
      PriceAlertKind.portfolioThreshold =>
        'Portfolio ${direction.name} \$${_fmt(threshold)}',
    };
  }

  bool _directionHit(double value, double threshold, PriceAlertDirection direction) {
    return switch (direction) {
      PriceAlertDirection.above => value >= threshold,
      PriceAlertDirection.below => value <= threshold,
      PriceAlertDirection.either => value >= threshold || value <= threshold,
    };
  }

  String _fmt(double n) {
    if (n >= 1000) return n.toStringAsFixed(0);
    return n.toStringAsFixed(2);
  }
}
