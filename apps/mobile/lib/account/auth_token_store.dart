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
              // Aliases are version-stable. Do not key them on versionCode
              // or build time — Play-style updates must keep reading the same store.
              aOptions: AndroidOptions(
                encryptedSharedPreferences: true,
                sharedPreferencesName: 'FlutterSecureStorage',
                resetOnError: false,
              ),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
            );

  final FlutterSecureStorage _s;

  static const _kAccess = 'auvora_acct_access_v1';
  static const _kRefresh = 'auvora_acct_refresh_v1';
  static const _kSession = 'auvora_acct_session_v1';
  static const _kAccessExpires = 'auvora_acct_access_exp_v1';
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

  Future<bool> get hasAccessToken async {
    final v = await readAccessToken();
    return v != null && v.isNotEmpty;
  }

  Future<bool> get hasRefreshSession async {
    final v = await readRefreshToken();
    return v != null && v.isNotEmpty;
  }

  /// True when a persisted expiry is in the past. Missing expiry is not expired
  /// (older installs) — caller should validate via /me then refresh.
  Future<bool> get accessExpired async {
    final raw = await _s.read(key: _kAccessExpires);
    if (raw == null || raw.isEmpty) return false;
    final exp = DateTime.tryParse(raw);
    if (exp == null) return false;
    return !DateTime.now().toUtc().isBefore(exp);
  }

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
    int? expiresIn,
  }) async {
    await _s.write(key: _kAccess, value: accessToken);
    await _s.write(key: _kSession, value: sessionId);
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await _s.write(key: _kRefresh, value: refreshToken);
    }
    if (expiresIn != null && expiresIn > 0) {
      final exp = DateTime.now().toUtc().add(Duration(seconds: expiresIn));
      await _s.write(key: _kAccessExpires, value: exp.toIso8601String());
    }
  }

  /// LOCAL QA ONLY. Marks the access token expired so [accessExpired] is true.
  /// Does not delete or rotate the refresh token.
  Future<void> markAccessExpiredForLocalQa() async {
    final past = DateTime.now().toUtc().subtract(const Duration(minutes: 2));
    await _s.write(key: _kAccessExpires, value: past.toIso8601String());
  }

  Future<void> saveIdentity({required String id, required String email, required String username}) async {
    await _s.write(key: _kUserId, value: id);
    await _s.write(key: _kEmail, value: email);
    await _s.write(key: _kUsername, value: username);
  }

  /// Clear ONLY account auth material. Never touches the on-device wallet vault.
  Future<void> clear() async {
    for (final k in [_kAccess, _kRefresh, _kSession, _kAccessExpires, _kUserId, _kEmail, _kUsername]) {
      await _s.delete(key: k);
    }
    // Intentionally preserve the device fingerprint for stable device identity.
  }
}
