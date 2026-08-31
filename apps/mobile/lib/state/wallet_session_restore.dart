/// Wallet restore routing after process restart / app update.
///
/// [onboardingFlag] is a SharedPreferences hint. It must never be the only
/// signal: a missing flag after `adb install -r` is not a new user.
enum WalletRestoreTarget { splash, unlock, securityPin, welcome }

abstract final class WalletSessionRestore {
  static const sessionExpiredMessage = 'Your session has expired. Sign in again.';

  static bool hasExistingWallet({
    required bool hasVault,
    required bool hasAddress,
    required bool hasPin,
  }) =>
      hasVault || hasAddress || hasPin;

  static bool shouldHealOnboarded({
    required bool hasVault,
    required bool hasAddress,
    required bool hasPin,
  }) =>
      (hasVault || hasAddress) && hasPin;

  /// Decide the first interactive stage after restore I/O finishes (or times out).
  ///
  /// Timeout with no evidence yet stays on splash so the caller can retry.
  /// Welcome is only for a completed restore that found no local wallet.
  static WalletRestoreTarget decide({
    required bool hasVault,
    required bool hasAddress,
    required bool hasPin,
    required bool onboardingFlag,
    required bool timedOut,
    required bool bootstrapCompleted,
  }) {
    final existing = hasExistingWallet(
      hasVault: hasVault,
      hasAddress: hasAddress,
      hasPin: hasPin,
    );
    if (existing && hasPin) return WalletRestoreTarget.unlock;
    if (existing && !hasPin) return WalletRestoreTarget.securityPin;
    if (onboardingFlag) {
      return hasPin ? WalletRestoreTarget.unlock : WalletRestoreTarget.securityPin;
    }
    if (timedOut && !bootstrapCompleted) return WalletRestoreTarget.splash;
    return WalletRestoreTarget.welcome;
  }
}
