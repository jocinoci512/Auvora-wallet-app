import 'package:auvora_wallet/security/security_controller.dart';
import 'package:auvora_wallet/security/security_models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('security controller boots with this-device only (no synthetic unknowns)', () async {
    final controller = SecurityController();
    await controller.bootstrap();

    final snapshot = controller.buildSnapshot();
    expect(snapshot.trustedDevices, isNotEmpty);
    expect(snapshot.trustedDevices.every((d) => d.trusted), isTrue);
    expect(snapshot.activeSessions, isNotEmpty);
    expect(snapshot.activeSessions.every((s) => s.current), isTrue);
    expect(snapshot.connectedDapps, isEmpty);
    expect(snapshot.score, inInclusiveRange(0, 100));
    expect(snapshot.checkSteps.length, greaterThanOrEqualTo(7));
    expect(snapshot.recommendations, isNotEmpty);
  });

  test('security preferences persist review updates', () async {
    final controller = SecurityController();
    await controller.bootstrap();
    await controller.markDevicesReviewed();
    await controller.markDappsReviewed();
    await controller.markSessionsReviewed();
    await controller.confirmAppUpdated();

    final refreshed = SecurityController();
    await refreshed.bootstrap();
    expect(refreshed.preferences.reviewedTrustedDevices, isTrue);
    expect(refreshed.preferences.reviewedConnectedDapps, isTrue);
    expect(refreshed.preferences.reviewedSessions, isTrue);
    expect(refreshed.preferences.appUpdated, isTrue);
  });

  test('status buckets map correctly from score', () {
    expect(securityStatusForScore(95), SecurityStatus.excellent);
    expect(securityStatusForScore(80), SecurityStatus.good);
    expect(securityStatusForScore(60), SecurityStatus.fair);
    expect(securityStatusForScore(30), SecurityStatus.needsAttention);
  });

  test('send funds always require auth (fail-closed)', () async {
    final controller = SecurityController();
    await controller.bootstrap();
    expect(controller.requiresAuth(AuthRequirementScope.sendFunds), isTrue);
    await controller.patchPreferences(controller.preferences.copyWith(requireAuthForSend: false));
    expect(controller.requiresAuth(AuthRequirementScope.sendFunds), isTrue);
  });

  test('sign out other sessions keeps current', () async {
    final controller = SecurityController();
    await controller.bootstrap();
    controller.sessions = [
      ...controller.sessions,
      ActiveSession(
        id: 'sess-other',
        deviceName: 'Other device',
        platform: 'Web',
        location: 'Unknown',
        loginAt: DateTime.now().subtract(const Duration(days: 1)),
        lastActiveAt: DateTime.now().subtract(const Duration(hours: 2)),
        authMethod: 'PIN',
        current: false,
      ),
    ];
    await controller.signOutAllOtherSessions();
    expect(controller.sessions.every((s) => s.current), isTrue);
    expect(controller.alerts.any((a) => a.title.contains('signed out')), isTrue);
  });

  test('data export and deletion requests persist', () async {
    final controller = SecurityController();
    await controller.bootstrap();
    await controller.requestDataExport();
    await controller.requestDataDeletion();
    expect(controller.preferences.dataExportRequestedAt, isNotNull);
    expect(controller.preferences.dataDeletionRequestedAt, isNotNull);

    final refreshed = SecurityController();
    await refreshed.bootstrap();
    expect(refreshed.preferences.dataExportRequestedAt, isNotNull);
    expect(refreshed.preferences.dataDeletionRequestedAt, isNotNull);
  });

  test('emergency lock records alert and privacy prefs', () async {
    final controller = SecurityController();
    await controller.bootstrap();
    await controller.emergencyLock();
    expect(controller.preferences.hideSensitiveInfo, isTrue);
    expect(controller.preferences.notificationPrivacy, isTrue);
    expect(controller.preferences.emergencyNotificationsMuted, isTrue);
    expect(controller.alerts.any((a) => a.title.toLowerCase().contains('emergency')), isTrue);
  });
}
