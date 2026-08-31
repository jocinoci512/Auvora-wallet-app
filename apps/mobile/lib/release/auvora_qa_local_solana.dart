/// Compile-time gate for **Auvora Local Solana QA** (solana-test-validator).
///
/// Enabled only via `--dart-define=AUVORA_QA_LOCAL_SOLANA=true` on the isolated
/// QA APK. Never enables mainnet. Public Devnet remains the external smoke path.
library;

import 'integration_config.dart';

abstract final class AuvoraQaLocalSolana {
  static const bool enabled = bool.fromEnvironment(
    'AUVORA_QA_LOCAL_SOLANA',
    defaultValue: false,
  );

  /// Loopback validator RPC. Device reaches it via `adb reverse tcp:8899 tcp:8899`.
  static const String rpcUrl = String.fromEnvironment(
    'AUVORA_QA_SOLANA_RPC',
    defaultValue: 'http://127.0.0.1:8899',
  );

  /// Deterministic LOCAL QA recipient (public only).
  /// Derived from BIP39 `abandon … about` at `m/44'/501'/0'/0'` — never the user key.
  static const String controlledRecipient = String.fromEnvironment(
    'AUVORA_QA_SOLANA_RECIPIENT',
    defaultValue: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
  );

  /// Existing registered Auvora QA Solana public address (parity target).
  static const String registeredQaAddress = String.fromEnvironment(
    'AUVORA_QA_SOLANA_ADDRESS',
    defaultValue: '8jFiN4JabxmBwkCVVFnaNyszExbCdd7k2TDuFQHyNThQ',
  );

  /// Sentinel chain id for Local Solana QA completion reporting (not EVM).
  /// Devnet smoke uses [devnetCompletionChainId]. Never mainnet.
  static const int localCompletionChainId = 901001019;
  static const int devnetCompletionChainId = 901;

  static const String networkLabel = 'Auvora Local Solana QA';
  static const String laneLabel = 'Local Solana QA';
  static const String bannerLabel = 'LOCAL QA';
  static const String feeAssetLabel = 'QA SOL';
  static const String nativeAssetLabel = 'QA SOL';

  /// Prefer explicit AUVORA_QA_SOLANA_RPC, then SOL_RPC_URL override, then default loopback.
  static String get effectiveRpcUrl {
    final qa = rpcUrl.trim();
    if (qa.isNotEmpty) return qa;
    final sol = IntegrationConfig.solRpcUrl.trim();
    if (sol.isNotEmpty) return sol;
    return 'http://127.0.0.1:8899';
  }

  static bool get isActive => enabled;
}
