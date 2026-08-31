/// Short-lived in-memory holder for the account password after sign-in/register.
///
/// Used only to encrypt/upload the cross-device vault without a second prompt
/// during first-device onboarding. Never written to disk or logs.
class AccountPasswordSession {
  AccountPasswordSession._();

  static String? _password;
  static DateTime? _expiresAt;

  static const Duration _ttl = Duration(minutes: 45);

  /// Capture password after a successful auth (memory only).
  static void capture(String password) {
    final trimmed = password.trim();
    if (trimmed.isEmpty) return;
    _password = trimmed;
    _expiresAt = DateTime.now().toUtc().add(_ttl);
  }

  /// Peek without clearing (null if expired/missing).
  static String? peek() {
    final exp = _expiresAt;
    final pw = _password;
    if (pw == null || exp == null) return null;
    if (DateTime.now().toUtc().isAfter(exp)) {
      clear();
      return null;
    }
    return pw;
  }

  /// Clear sensitive material as soon as vault upload/restore succeeds or TTL ends.
  static void clear() {
    _password = null;
    _expiresAt = null;
  }
}
