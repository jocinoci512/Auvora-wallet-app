import 'package:auvora_wallet/preferences/models.dart';
import 'package:auvora_wallet/preferences/preferences_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('preferences bootstrap seeds inbox and alerts', () async {
    final c = PreferencesController();
    await c.bootstrap();
    expect(c.loading, isFalse);
    expect(c.inbox, isNotEmpty);
    expect(c.priceAlerts, isNotEmpty);
    expect(c.materialThemeMode, ThemeMode.system);
  });

  test('theme preference maps to ThemeMode', () async {
    final c = PreferencesController();
    await c.bootstrap();
    await c.setTheme(AppThemePreference.dark);
    expect(c.materialThemeMode, ThemeMode.dark);
    await c.setTheme(AppThemePreference.light);
    expect(c.materialThemeMode, ThemeMode.light);
  });

  test('notification toggles gate inbox enqueue', () async {
    final c = PreferencesController();
    await c.bootstrap();
    await c.setNotificationEnabled(NotificationCategory.priceAlerts, false);
    final before = c.inbox.length;
    await c.enqueueNotification(
      category: NotificationCategory.priceAlerts,
      title: 'Should not appear',
      body: 'gated',
    );
    expect(c.inbox.length, before);

    await c.setNotificationEnabled(NotificationCategory.priceAlerts, true);
    await c.enqueueNotification(
      category: NotificationCategory.priceAlerts,
      title: 'Should appear',
      body: 'ok',
    );
    expect(c.inbox.any((n) => n.title == 'Should appear'), isTrue);
  });

  test('price alert CRUD pause and delete', () async {
    final c = PreferencesController();
    await c.bootstrap();
    final alert = await c.createPriceAlert(
      kind: PriceAlertKind.assetTarget,
      assetSymbol: 'ETH',
      threshold: 4000,
      direction: PriceAlertDirection.above,
    );
    expect(c.priceAlerts.any((a) => a.id == alert.id), isTrue);
    await c.pausePriceAlert(alert.id, paused: true);
    expect(c.priceAlerts.firstWhere((a) => a.id == alert.id).paused, isTrue);
    await c.deletePriceAlert(alert.id);
    expect(c.priceAlerts.any((a) => a.id == alert.id), isFalse);
  });

  test('account nickname and preview wallet switch', () async {
    final c = PreferencesController();
    await c.bootstrap();
    await c.setWalletNickname('Savings');
    expect(c.account.walletNickname, 'Savings');
    final other = c.previewWallets.firstWhere((w) => !w.active);
    await c.setActivePreviewWallet(other.id);
    expect(c.previewWallets.firstWhere((w) => w.id == other.id).active, isTrue);
  });

  test('locale and accessibility persist', () async {
    final c = PreferencesController();
    await c.bootstrap();
    await c.setLocale(c.locale.copyWith(currency: FiatCurrency.eur, dateFormat: DateFormatPreference.dmy));
    await c.setAccessibility(c.accessibility.copyWith(reduceMotion: true, textScale: 1.2));

    final again = PreferencesController();
    await again.bootstrap();
    expect(again.locale.currency, FiatCurrency.eur);
    expect(again.locale.dateFormat, DateFormatPreference.dmy);
    expect(again.accessibility.reduceMotion, isTrue);
    expect(again.accessibility.textScale, 1.2);
  });

  test('accent preference persists', () async {
    final c = PreferencesController();
    await c.bootstrap();
    await c.setAccent(AccentColorPreference.forest);
    expect(c.accent, AccentColorPreference.forest);
  });

  test('pending and failed notification categories exist in catalog', () {
    final ids = kNotificationCatalog.map((e) => e.id).toSet();
    expect(ids.contains(NotificationCategory.pendingConfirmations), isTrue);
    expect(ids.contains(NotificationCategory.failedTransactions), isTrue);
  });
}
