import '../release/release_config.dart';
import 'rpc_endpoints.dart';

/// Fail-closed gate for locally signed Bitcoin Testnet / Regtest broadcast.
abstract final class BitcoinTestnetBroadcast {
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
      throw StateError('Refusing Bitcoin mainnet RPC host.');
    }
  }

  static bool get enabledNow =>
      ReleaseConfig.canBroadcastTestnet && !ReleaseConfig.liveBroadcastEnabled;
}
