import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stores per-request X25519 private keys for device recovery (never logged).
class DeviceRecoveryKeyStore {
  DeviceRecoveryKeyStore({FlutterSecureStorage? storage})
      : _s = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(
                encryptedSharedPreferences: true,
                sharedPreferencesName: 'FlutterSecureStorage',
                resetOnError: false,
              ),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
            );

  final FlutterSecureStorage _s;

  String _key(String requestId) => 'auvora_device_recovery_sk_$requestId';

  Future<void> savePrivateKey({
    required String requestId,
    required String privateKeyBase64,
  }) async {
    await _s.write(key: _key(requestId), value: privateKeyBase64);
  }

  Future<String?> readPrivateKey(String requestId) => _s.read(key: _key(requestId));

  Future<void> deletePrivateKey(String requestId) => _s.delete(key: _key(requestId));
}
