import 'package:auvora_wallet/preferences/models.dart';
import 'package:auvora_wallet/preferences/preferences_controller.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('KYC approval maps to security inbox with customer title only', () {
    final item = PreferencesController().mapBackendNotificationForTest({
      'id': 'n-kyc-approved',
      'subject': 'Identity verification approved',
      'body': 'Your identity verification was approved.',
      'category': 'KYC',
      'createdAt': '2026-08-28T19:44:13.000Z',
      'metadata': {'internalAdminNote': 'must never appear'},
    });
    expect(item.category, NotificationCategory.securityAlerts);
    expect(item.title, 'Identity verification approved');
    expect(item.body, isNot(contains('must never appear')));
  });
}
