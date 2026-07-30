import 'package:auvora_wallet/security/security_controller.dart';
import 'package:auvora_wallet/security/security_models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('security controller boots preview data and computes a score', () async {
    final controller = SecurityController();
    await controller.bootstrap();

    final snapshot = controller.buildSnapshot();
    expect(snapshot.trustedDevices, isNotEmpty);
    expect(snapshot.activeSessions, isNotEmpty);
    expect(snapshot.connectedDapps, isNotEmpty);
    expect(snapshot.recentAlerts, isNotEmpty);
    expect(snapshot.score, inInclusiveRange(0, 100));
  });

  test('security preferences persist review updates', () async {
    final controller = SecurityController();
    await controller.bootstrap();
    await controller.markDevicesReviewed();
    await controller.markDappsReviewed();
    await controller.confirmAppUpdated();

    final refreshed = SecurityController();
    await refreshed.bootstrap();
    expect(refreshed.preferences.reviewedTrustedDevices, isTrue);
    expect(refreshed.preferences.reviewedConnectedDapps, isTrue);
    expect(refreshed.preferences.appUpdated, isTrue);
  });

  test('status buckets map correctly from score', () {
    expect(securityStatusForScore(95), SecurityStatus.excellent);
    expect(securityStatusForScore(80), SecurityStatus.good);
    expect(securityStatusForScore(60), SecurityStatus.fair);
    expect(securityStatusForScore(30), SecurityStatus.needsAttention);
  });
}
