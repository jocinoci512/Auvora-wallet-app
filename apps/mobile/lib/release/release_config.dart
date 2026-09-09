import 'integration_config.dart';
import 'network_env.dart';

/// Version 1.0 Alpha / release gates. Flip kill switches only after security sign-off.
///
/// Secrets and partner keys live in [IntegrationConfig] (`--dart-define`), never here.
abstract final class ReleaseConfig {
  static const String releaseChannel = 'alpha';
  static const String marketingVersion = '1.0.0-alpha.3';
  static const String buildLabel = 'Version 1.0 Alpha';
  /// Must match pubspec `+N` for release guards / update policy.
  static const int versionCode = 32;

  /// Live **mainnet** chain broadcast. Keep false — never enable for production funds.
  static const bool liveBroadcastEnabled = false;

  /// Independent Mainnet Chain Rollout Gates (All default strictly to false / OFF).
  /// Defense-in-depth: Mainnet must NOT be activated for all chains simultaneously.
  /// Both [liveBroadcastEnabled] AND the chain-specific switch must be true for broadcast.
  static const bool mainnetEthereumEnabled = false;
  static const bool mainnetBnbEnabled = false;
  static const bool mainnetPolygonEnabled = false;
  static const bool mainnetSolanaEnabled = false;
  static const bool mainnetBitcoinEnabled = false;
  static const bool mainnetTronEnabled = false;

  /// Returns whether a specific chain has live broadcast enabled.
  /// Always returns false if the global [liveBroadcastEnabled] kill switch is false.
  static bool isChainLiveBroadcastAllowed(String chain) {
    if (!liveBroadcastEnabled) return false;
    switch (chain.toUpperCase()) {
      case 'ETHEREUM':
      case 'ETH':
        return mainnetEthereumEnabled;
      case 'BNB_SMART_CHAIN':
      case 'BNB':
      case 'BSC':
        return mainnetBnbEnabled;
      case 'POLYGON':
      case 'POL':
      case 'MATIC':
        return mainnetPolygonEnabled;
      case 'SOLANA':
      case 'SOL':
        return mainnetSolanaEnabled;
      case 'BITCOIN':
      case 'BTC':
        return mainnetBitcoinEnabled;
      case 'TRON':
      case 'TRX':
        return mainnetTronEnabled;
      default:
        return false;
    }
  }

  /// Allow broadcast of locally signed **TESTNET** txs only when
  /// `AUVORA_NETWORK_ENV=testnet` and this define is true.
  /// Does not enable mainnet broadcast.
  static const bool testnetBroadcastEnabled = bool.fromEnvironment(
    'TESTNET_BROADCAST_ENABLED',
    defaultValue: false,
  );

  static bool get networkIsTestnet => AuvoraNetworkEnv.isTestnet;

  /// True only when testnet mode + testnet broadcast define are both active.
  static bool get canBroadcastTestnet =>
      networkIsTestnet && testnetBroadcastEnabled && !liveBroadcastEnabled;

  /// When false, Receive blocks QR, copy, and share for funding addresses.
  /// Addresses may be shown while live broadcast remains off — deposits cannot
  /// be withdrawn on-chain in this Alpha until broadcast is enabled.
  static const bool allowFundingAddresses = true;

  /// Address derivation quality for this build.
  /// BIP32/SLIP-0010 is active.
  static const DerivationMode derivationMode = DerivationMode.bip32Partial;

  static const String fundingBlockedMessage =
      'Addresses use BIP32 / SLIP-0010 HD paths, but Receive funding stays '
      'locked in Version 1.0 Alpha until off-device verification completes. '
      'QR, copy, and share are disabled — do not send real funds yet.';

  static const String broadcastPreviewMessage =
      'Transfers stay on this device as a preview. Live broadcast is off '
      '(kill switch) until network signing is audited.';

  static String get broadcastStatusMessage {
    if (liveBroadcastEnabled) {
      return 'Mainnet broadcast is ON — use only with audited adapters.';
    }
    if (canBroadcastTestnet) {
      return 'TESTNET / Local EVM QA broadcast is ON for allowlisted networks only. Mainnet broadcast remains OFF.';
    }
    if (networkIsTestnet) {
      return 'TESTNET mode is active. Broadcast stays off until TESTNET_BROADCAST_ENABLED=true.';
    }
    return broadcastPreviewMessage;
  }

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
