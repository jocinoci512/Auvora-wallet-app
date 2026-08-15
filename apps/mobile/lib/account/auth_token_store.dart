import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

/// Platform-encrypted storage for Auvora *account* auth material only.
///
/// Stores the minimum needed for session continuity — access token, refresh
/// token, sessionId, a stable device fingerprint, and cached safe identity
/// (id/email/username). It NEVER stores passwords or any wallet secret
/// (mnemonic / private key / seed / vault) — those live in [SecureKeyStore].
class AuthTokenStore {
  AuthTokenStore({FlutterSecureStorage? storage})
      : _s = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
            );

  final FlutterSecureStorage _s;

  static const _kAccess = 'auvora_acct_access_v1';
  static const _kRefresh = 'auvora_acct_refresh_v1';
  static const _kSession = 'auvora_acct_session_v1';
  static const _kFingerprint = 'auvora_acct_device_fp_v1';
  static const _kUserId = 'auvora_acct_uid_v1';
  static const _kEmail = 'auvora_acct_email_v1';
  static const _kUsername = 'auvora_acct_username_v1';

  Future<String?> readAccessToken() => _s.read(key: _kAccess);
  Future<String?> readRefreshToken() => _s.read(key: _kRefresh);
  Future<String?> readSessionId() => _s.read(key: _kSession);
  Future<String?> readUserId() => _s.read(key: _kUserId);
  Future<String?> readEmail() => _s.read(key: _kEmail);
  Future<String?> readUsername() => _s.read(key: _kUsername);

  /// Stable per-install device fingerprint (>= 8 chars, required by login).
  Future<String> deviceFingerprint() async {
    final existing = await _s.read(key: _kFingerprint);
    if (existing != null && existing.length >= 8) return existing;
    final fp = 'and-${const Uuid().v4()}';
    await _s.write(key: _kFingerprint, value: fp);
    return fp;
  }

  Future<void> saveSession({
    required String accessToken,
    required String sessionId,
    String? refreshToken,
  }) async {
    await _s.write(key: _kAccess, value: accessToken);
    await _s.write(key: _kSession, value: sessionId);
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await _s.write(key: _kRefresh, value: refreshToken);
    }
  }

  Future<void> saveIdentity({required String id, required String email, required String username}) async {
    await _s.write(key: _kUserId, value: id);
    await _s.write(key: _kEmail, value: email);
    await _s.write(key: _kUsername, value: username);
  }

  /// Clear ONLY account auth material. Never touches the on-device wallet vault.
  Future<void> clear() async {
    for (final k in [_kAccess, _kRefresh, _kSession, _kUserId, _kEmail, _kUsername]) {
      await _s.delete(key: k);
    }
    // Intentionally preserve the device fingerprint for stable device identity.
  }
}
