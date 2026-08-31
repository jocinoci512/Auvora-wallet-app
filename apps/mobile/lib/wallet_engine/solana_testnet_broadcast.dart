import '../release/auvora_qa_local_solana.dart';
import '../release/release_config.dart';
import 'rpc_endpoints.dart';

/// Fail-closed gate for locally signed Solana Devnet / Local QA broadcast.
abstract final class SolanaTestnetBroadcast {
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
      throw StateError('Refusing Solana mainnet RPC host.');
    }
    if (AuvoraQaLocalSolana.isActive && !_isLocalValidator(rpcUrl)) {
      throw StateError(
          'Local Solana QA may broadcast only to loopback port 8899.');
    }
  }

  static bool _isLocalValidator(String rpcUrl) {
    final uri = Uri.tryParse(rpcUrl);
    if (uri == null) return false;
    final host = uri.host.toLowerCase();
    final loopback =
        host == '127.0.0.1' || host == 'localhost' || host == '::1';
    return loopback && uri.port == 8899;
  }

  static bool get enabledNow =>
      ReleaseConfig.canBroadcastTestnet && !ReleaseConfig.liveBroadcastEnabled;
}
