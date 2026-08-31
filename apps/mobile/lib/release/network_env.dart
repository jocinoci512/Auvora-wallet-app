/// Isolated QA / testnet network environment for Auvora mobile.
///
/// Compile-time via `--dart-define=AUVORA_NETWORK_ENV=testnet`.
/// Never confuses with production mainnet. Mainnet HD paths stay unchanged
/// when [NetworkEnv.isMainnet] is true.
library;

import '../portfolio/models.dart';
import 'auvora_qa_local_evm.dart';

enum NetworkEnv { mainnet, testnet }

/// Pure catalog helpers — pass [NetworkEnv] explicitly so unit tests can cover
/// both modes without requiring a separate dart-define binary.
abstract final class NetworkCatalog {
  /// Networks exposed in Receive / Send selectors (product chain set).
  static const List<AssetNetwork> receiveNetworks = [
    AssetNetwork.ethereum,
    AssetNetwork.bnbSmartChain,
    AssetNetwork.polygon,
    AssetNetwork.solana,
    AssetNetwork.bitcoin,
    AssetNetwork.tron,
  ];

  /// Professional UI label. Testnet never silently says "Mainnet".
  static String displayName(AssetNetwork network, NetworkEnv env) {
    if (env != NetworkEnv.testnet) return network.label;
    if (AuvoraQaLocalEvm.isActive && network == AssetNetwork.ethereum) {
      return AuvoraQaLocalEvm.networkLabel;
    }
    return switch (network) {
      AssetNetwork.ethereum => 'Ethereum · Sepolia',
      AssetNetwork.bnbSmartChain => 'BNB Smart Chain · Testnet',
      AssetNetwork.polygon => 'Polygon · Amoy',
      AssetNetwork.solana => 'Solana · Devnet',
      AssetNetwork.bitcoin => 'Bitcoin · Testnet3',
      AssetNetwork.tron => 'Tron · Nile',
    };
  }

  /// Short lane name for "Network: Sepolia" style copy.
  static String laneName(AssetNetwork network, NetworkEnv env) {
    if (env != NetworkEnv.testnet) return network.label;
    if (AuvoraQaLocalEvm.isActive && network == AssetNetwork.ethereum) {
      return AuvoraQaLocalEvm.laneLabel;
    }
    return switch (network) {
      AssetNetwork.ethereum => 'Sepolia',
      AssetNetwork.bnbSmartChain => 'BSC Testnet',
      AssetNetwork.polygon => 'Amoy',
      AssetNetwork.solana => 'Devnet',
      AssetNetwork.bitcoin => 'Testnet3',
      AssetNetwork.tron => 'Nile',
    };
  }

  static int? evmChainId(AssetNetwork network, NetworkEnv env) {
    if (env != NetworkEnv.testnet) {
      return switch (network) {
        AssetNetwork.ethereum => 1,
        AssetNetwork.bnbSmartChain => 56,
        AssetNetwork.polygon => 137,
        _ => null,
      };
    }
    if (AuvoraQaLocalEvm.isActive && network == AssetNetwork.ethereum) {
      return AuvoraQaLocalEvm.chainId;
    }
    return switch (network) {
      AssetNetwork.ethereum => 11155111,
      AssetNetwork.bnbSmartChain => 97,
      AssetNetwork.polygon => 80002,
      _ => null,
    };
  }

  static String? eip155Caip(AssetNetwork network, NetworkEnv env) {
    final id = evmChainId(network, env);
    if (id == null) return null;
    return 'eip155:$id';
  }

  /// True when [chainId] is a known production EVM mainnet id.
  static bool isMainnetEvmChainId(int chainId) =>
      mainnetEvmChainIds.contains(chainId);

  static const Set<int> mainnetEvmChainIds = {1, 56, 137};
}

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

  /// Persistent UI label — never omit when testnet / local QA.
  static String get bannerLabel {
    if (!isTestnet) return '';
    if (AuvoraQaLocalEvm.isActive) return AuvoraQaLocalEvm.bannerLabel;
    return 'TESTNET';
  }

  static String displayName(AssetNetwork network) =>
      NetworkCatalog.displayName(network, current);

  static String laneName(AssetNetwork network) =>
      NetworkCatalog.laneName(network, current);

  static int? evmChainId(AssetNetwork network) =>
      NetworkCatalog.evmChainId(network, current);

  static const Set<int> mainnetEvmChainIds = NetworkCatalog.mainnetEvmChainIds;
}
