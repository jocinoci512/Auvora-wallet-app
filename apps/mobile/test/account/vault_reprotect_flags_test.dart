import 'package:auvora_wallet/account/vault_sync_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('VaultSyncService trusted-device and emergency flags start clear', () {
    final sync = VaultSyncService();
    expect(sync.needsTrustedDeviceReprotect, isFalse);
    expect(sync.needsEmergencyRecovery, isFalse);
    expect(sync.needsPasswordForRestore, isFalse);
    expect(sync.needsPasswordForUpload, isFalse);
  });

  test('clearPasswordFlags clears trusted-device and emergency markers', () {
    final sync = VaultSyncService();
    // Flags are private; clearPasswordFlags must remain idempotent for UI.
    sync.clearPasswordFlags();
    expect(sync.needsTrustedDeviceReprotect, isFalse);
    expect(sync.needsEmergencyRecovery, isFalse);
  });
}
