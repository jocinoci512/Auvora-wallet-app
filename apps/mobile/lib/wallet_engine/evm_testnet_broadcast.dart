import '../release/auvora_qa_local_evm.dart';
import '../release/release_config.dart';
import 'rpc_endpoints.dart';

/// Fail-closed gates for locally signed TESTNET / Local EVM QA broadcast.
///
/// Mainnet chain IDs, mainnet RPC hosts, and [ReleaseConfig.liveBroadcastEnabled]
/// are always refused. Signing still happens on-device only.
abstract final class EvmTestnetBroadcast {
  static const Set<int> mainnetChainIds = {1, 56, 137, 43114, 42161, 10};
  static const Set<int> allowlistedTestnetChainIds = {
    11155111,
    97,
    80002,
    31337, // Auvora Local EVM QA (Anvil) — never mainnet
  };

  static void assertAllowed({
    required int chainId,
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
    if (mainnetChainIds.contains(chainId)) {
      throw StateError('Refusing mainnet chain id $chainId.');
    }
    if (!allowlistedTestnetChainIds.contains(chainId)) {
      throw StateError('Chain id $chainId is not an allowlisted testnet.');
    }
    if (AuvoraQaLocalEvm.isActive && chainId == AuvoraQaLocalEvm.chainId) {
      // Local Anvil loopback is the intended destination for isolated QA.
      return;
    }
    if (RpcEndpoints.looksLikeMainnetUrl(rpcUrl)) {
      throw StateError('Refusing mainnet RPC host.');
    }
  }

  static bool get enabledNow => ReleaseConfig.canBroadcastTestnet && !ReleaseConfig.liveBroadcastEnabled;
}
