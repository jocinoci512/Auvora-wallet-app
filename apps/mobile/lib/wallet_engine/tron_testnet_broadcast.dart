import '../release/release_config.dart';
import 'rpc_endpoints.dart';

/// Fail-closed gate for locally signed Tron Testnet (Nile) broadcast.
abstract final class TronTestnetBroadcast {
  static void assertAllowed({
    required bool canBroadcastTestnet,
    required bool liveBroadcastEnabled,
    required bool isTestnetEnv,
    required String rpcUrl,
  }) {
    if (liveBroadcastEnabled) {
      throw StateError('Mainnet broadcast kill switch must stay off.');
    }
    if (!isTestnetEnv || !canBroadcastTestnet) {
      throw StateError('Testnet broadcast is not enabled.');
    }
    if (RpcEndpoints.looksLikeMainnetUrl(rpcUrl)) {
      throw StateError('Refusing Tron mainnet RPC host.');
    }
  }

  static bool get enabledNow =>
      ReleaseConfig.canBroadcastTestnet && !ReleaseConfig.liveBroadcastEnabled;
}
