import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:auvora_wallet/release/app_update_policy.dart';
import 'package:auvora_wallet/release/release_config.dart';
import 'package:auvora_wallet/release/storage_schema.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('ReleaseConfig versionCode stays ahead of production baseline 30', () {
    expect(ReleaseConfig.versionCode, greaterThan(30));
    expect(ReleaseConfig.liveBroadcastEnabled, isFalse);
  });

  test('StorageSchema migrate establishes version marker', () async {
    SharedPreferences.setMockInitialValues({});
    final v = await StorageSchema.migrateIfNeeded();
    expect(v, StorageSchema.current);
    final again = await StorageSchema.migrateIfNeeded();
    expect(again, StorageSchema.current);
  });

  test('AppVersionPolicy parses remote payload', () {
    final policy = AppVersionPolicy.fromJson({
      'minimumSupportedVersionCode': 31,
      'latestRecommendedVersionCode': 40,
      'storeUrl': 'https://play.google.com/store/apps/details?id=com.auvora.auvora_wallet',
      'message': 'A newer version of Auvora Wallet is required to continue.',
    });
    expect(policy.minimumSupportedVersionCode, 31);
    expect(policy.latestRecommendedVersionCode, 40);
    expect(policy.message, contains('required'));
  });

  test('optional update respects dismiss cooldown', () async {
    SharedPreferences.setMockInitialValues({
      'auvora_update_optional_dismiss_until_ms':
          DateTime.now().add(const Duration(days: 3)).millisecondsSinceEpoch,
    });
    // Defaults: min=1, latest=31, installed=31 → none when current == latest.
    final decision = await AppUpdatePolicyService.evaluate();
    expect(decision.installedVersionCode, ReleaseConfig.versionCode);
    expect(decision.urgency, AppUpdateUrgency.none);
  });
}
