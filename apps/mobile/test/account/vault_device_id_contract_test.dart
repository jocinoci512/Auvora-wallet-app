import 'package:flutter_test/flutter_test.dart';

/// Mirrors vault_sync_service deviceId gate: only bare UUIDs are sent to Wallet.
String? uuidOrNull(String? value) {
  if (value == null) return null;
  final v = value.trim();
  final uuidRe = RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
  );
  return uuidRe.hasMatch(v) ? v : null;
}

void main() {
  test('Android fingerprint and-<uuid> is omitted from vault deviceId', () {
    expect(uuidOrNull('and-97cf116b-c6b4-4691-8746-e006096339b2'), isNull);
  });

  test('bare UUID is accepted as vault deviceId', () {
    expect(
      uuidOrNull('97cf116b-c6b4-4691-8746-e006096339b2'),
      '97cf116b-c6b4-4691-8746-e006096339b2',
    );
  });

  test('web-prefixed fingerprint is omitted', () {
    expect(uuidOrNull('web-ephemeral-123'), isNull);
  });
}
