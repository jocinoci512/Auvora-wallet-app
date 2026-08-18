import 'integration_config.dart';

/// Version 1.0 Alpha / release gates. Flip kill switches only after security sign-off.
///
/// Secrets and partner keys live in [IntegrationConfig] (`--dart-define`), never here.
abstract final class ReleaseConfig {
  static const String releaseChannel = 'alpha';
  static const String marketingVersion = '1.0.0-alpha.1';
  static const String buildLabel = 'Version 1.0 Alpha';

  /// Live chain broadcast. Keep false until adapters are audited end-to-end.
  static const bool liveBroadcastEnabled = false;

  /// When false, Receive blocks QR, copy, and share for funding addresses.
  /// Kept locked while Alpha validates HD addresses off-device.
  static const bool allowFundingAddresses = true;

  /// Address derivation quality for this build.
  /// BIP32/SLIP-0010 is active; funding stay gated until receive unlock sign-off.
  static const DerivationMode derivationMode = DerivationMode.bip32Partial;

  static const String fundingBlockedMessage =
      'Addresses use BIP32 / SLIP-0010 HD paths, but Receive funding stays '
      'locked in Version 1.0 Alpha until off-device verification completes. '
      'QR, copy, and share are disabled — do not send real funds yet.';

  static const String broadcastPreviewMessage =
      'Transfers stay on this device as a preview. Live broadcast is off '
      '(kill switch) until network signing is audited.';

  /// Soft client diagnostics / performance flags (no secrets).
  static const bool clientDiagnosticsEnabled = true;
  static const bool offlineQueueEnabled = true;
  static const bool aggressiveCachePurge = false;

  /// Live CoinGecko → CoinCap → Alchemy Prices → cached → seeded.
  /// Alchemy Prices activates only when a client key is present (dev); Alpha APK
  /// keeps Alchemy server-side. See [IntegrationConfig] / API guide.
  static const bool liveMarketPricesEnabled = true;

  /// Public RPC tip probes for diagnostics (not live broadcast).
  /// Override with `--dart-define=RPC_HEALTH_PROBE_ENABLED=false` if needed.
  static bool get rpcHealthProbeEnabled => IntegrationConfig.rpcHealthProbeEnabled;

  /// Public URLs for store / About (hosted companion or marketing site).
  static const String websiteUrl = 'https://auvorawallet.com';
  static const String privacyPolicyUrl = 'https://auvorawallet.com/legal/privacy';
  static const String termsOfServiceUrl = 'https://auvorawallet.com/legal/terms';
  static const String supportEmail = 'support@auvorawallet.com';
  static const String supportMailto =
      'mailto:support@auvorawallet.com?subject=Auvora%201.0%20Alpha%20feedback';

  static bool get isClosedBeta =>
      releaseChannel == 'closed-beta' || releaseChannel == 'alpha';

  static bool get isAlpha => releaseChannel == 'alpha';

  static bool get isReleaseCandidate => marketingVersion.contains('-rc.');

  static bool get usesHdDerivation =>
      derivationMode == DerivationMode.bip32Partial ||
      derivationMode == DerivationMode.production;

  /// Shape-preserving redaction while [allowFundingAddresses] is false.
  static String redactAddress(String address) {
    if (address.length < 12) return '••••••••';
    return '${address.substring(0, 6)}…${address.substring(address.length - 4)}';
  }
}

enum DerivationMode {
  previewSha,
  bip32Partial,
  production,
}
