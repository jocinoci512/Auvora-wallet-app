/// Isolated QA / testnet network environment for Auvora mobile.
///
/// Compile-time via `--dart-define=AUVORA_NETWORK_ENV=testnet`.
/// Never confuses with production mainnet. Mainnet HD paths stay unchanged
/// when [NetworkEnv.isMainnet] is true.
library;

import '../portfolio/models.dart';

enum NetworkEnv { mainnet, testnet }

abstract final class AuvoraNetworkEnv {
  /// `mainnet` (default) or `testnet`.
  static const String _raw = String.fromEnvironment(
    'AUVORA_NETWORK_ENV',
    defaultValue: 'mainnet',
  );

  static NetworkEnv get current {
    final v = _raw.trim().toLowerCase();
    if (v == 'testnet' || v == 'qa' || v == 'devnet') return NetworkEnv.testnet;
    return NetworkEnv.mainnet;
  }

  static bool get isTestnet => current == NetworkEnv.testnet;
  static bool get isMainnet => current == NetworkEnv.mainnet;

  /// Persistent UI label — never omit when testnet.
  static String get bannerLabel => isTestnet ? 'TESTNET' : '';

  static String displayName(AssetNetwork network) {
    if (!isTestnet) return network.label;
    return switch (network) {
      AssetNetwork.ethereum => 'Ethereum Sepolia (TESTNET)',
      AssetNetwork.bnbSmartChain => 'BNB Testnet (TESTNET)',
      AssetNetwork.polygon => 'Polygon Amoy (TESTNET)',
      AssetNetwork.solana => 'Solana Devnet (TESTNET)',
      AssetNetwork.bitcoin => 'Bitcoin Testnet3 (TESTNET)',
      AssetNetwork.tron => 'Tron Nile (TESTNET)',
    };
  }

  static int? evmChainId(AssetNetwork network) {
    if (!isTestnet) {
      return switch (network) {
        AssetNetwork.ethereum => 1,
        AssetNetwork.bnbSmartChain => 56,
        AssetNetwork.polygon => 137,
        _ => null,
      };
    }
    return switch (network) {
      AssetNetwork.ethereum => 11155111,
      AssetNetwork.bnbSmartChain => 97,
      AssetNetwork.polygon => 80002,
      _ => null,
    };
  }

  static const Set<int> mainnetEvmChainIds = {1, 56, 137};
}
