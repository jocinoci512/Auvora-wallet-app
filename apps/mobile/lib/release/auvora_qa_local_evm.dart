/// Compile-time gate for **Auvora Local EVM QA** (Anvil / chain 31337).
///
/// Enabled only via `--dart-define=AUVORA_QA_LOCAL_EVM=true` on the isolated
/// QA APK. Never enables mainnet. Public Sepolia remains the external smoke path.
library;

import 'integration_config.dart';

abstract final class AuvoraQaLocalEvm {
  static const bool enabled = bool.fromEnvironment(
    'AUVORA_QA_LOCAL_EVM',
    defaultValue: false,
  );

  static const int chainId = int.fromEnvironment(
    'AUVORA_QA_EVM_CHAIN_ID',
    defaultValue: 31337,
  );

  /// Loopback Anvil RPC. Device reaches it via `adb reverse tcp:8545 tcp:8545`.
  static const String rpcUrl = String.fromEnvironment(
    'AUVORA_QA_EVM_RPC',
    defaultValue: 'http://127.0.0.1:8545',
  );

  /// Deterministic Anvil account #1 — controlled LOCAL QA recipient only.
  static const String controlledRecipient = String.fromEnvironment(
    'AUVORA_QA_EVM_RECIPIENT',
    defaultValue: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  );

  static const String networkLabel = 'Auvora Local EVM QA';
  static const String laneLabel = 'Local EVM QA';
  static const String bannerLabel = 'LOCAL QA';

  /// Prefer explicit AUVORA_QA_EVM_RPC, then ETH_RPC_URL override, then default loopback.
  static String get effectiveRpcUrl {
    final qa = rpcUrl.trim();
    if (qa.isNotEmpty) return qa;
    final eth = IntegrationConfig.ethRpcUrl.trim();
    if (eth.isNotEmpty) return eth;
    return 'http://127.0.0.1:8545';
  }

  static bool get isActive => enabled;
}
