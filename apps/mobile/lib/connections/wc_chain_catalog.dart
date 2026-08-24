/// CAIP-2 chain catalog for WalletConnect / Reown session namespaces.
///
/// Only advertise capabilities Auvora can honor on-device. Do **not** fake
/// Bitcoin, Tron, or Solana WalletConnect support until production-capable.
///
/// When [AuvoraNetworkEnv.isTestnet], advertises Sepolia / BSC Testnet / Amoy
/// instead of mainnet EIP-155 IDs.
library;

import '../portfolio/models.dart';
import '../release/network_env.dart';

/// Supported WalletConnect namespaces for Auvora (EVM only in this sprint).
abstract final class WcChainCatalog {
  static const String ethereumMainnet = 'eip155:1';
  static const String bnbMainnet = 'eip155:56';
  static const String polygonMainnet = 'eip155:137';

  static const String ethereumSepolia = 'eip155:11155111';
  static const String bnbTestnet = 'eip155:97';
  static const String polygonAmoy = 'eip155:80002';

  static String get ethereum =>
      AuvoraNetworkEnv.isTestnet ? ethereumSepolia : ethereumMainnet;
  static String get bnbSmartChain =>
      AuvoraNetworkEnv.isTestnet ? bnbTestnet : bnbMainnet;
  static String get polygon =>
      AuvoraNetworkEnv.isTestnet ? polygonAmoy : polygonMainnet;

  /// Chains we register with Reown WalletKit.
  static List<String> get supportedEip155Chains => [
        ethereum,
        bnbSmartChain,
        polygon,
      ];

  /// Methods Auvora will handle. Explicitly excludes `eth_sign` (unsafe).
  static const List<String> supportedEvmMethods = [
    'personal_sign',
    'eth_signTypedData_v4',
    'eth_sendTransaction',
  ];

  /// Methods we reject safely when requested.
  static const List<String> rejectedUnsafeMethods = [
    'eth_sign',
  ];

  static const List<String> supportedEvents = [
    'chainChanged',
    'accountsChanged',
  ];

  /// Human network labels used across Connections UI.
  static String labelForCaip(String caip) {
    return switch (caip) {
      ethereumMainnet => 'ETHEREUM',
      bnbMainnet => 'BNB_SMART_CHAIN',
      polygonMainnet => 'POLYGON',
      ethereumSepolia => 'ETHEREUM_SEPOLIA_TESTNET',
      bnbTestnet => 'BNB_TESTNET',
      polygonAmoy => 'POLYGON_AMOY_TESTNET',
      _ when caip.startsWith('eip155:') => 'EVM:$caip',
      _ when caip.startsWith('solana:') => 'SOLANA (unsupported WC)',
      _ when caip.startsWith('bip122:') => 'BITCOIN (unsupported WC)',
      _ when caip.startsWith('tron:') => 'TRON (unsupported WC)',
      _ => caip.toUpperCase(),
    };
  }

  static String? caipForAssetNetwork(AssetNetwork network) {
    return switch (network) {
      AssetNetwork.ethereum => ethereum,
      AssetNetwork.bnbSmartChain => bnbSmartChain,
      AssetNetwork.polygon => polygon,
      AssetNetwork.bitcoin || AssetNetwork.solana || AssetNetwork.tron => null,
    };
  }

  static AssetNetwork? assetNetworkForCaip(String caip) {
    return switch (caip) {
      ethereumMainnet || ethereumSepolia => AssetNetwork.ethereum,
      bnbMainnet || bnbTestnet => AssetNetwork.bnbSmartChain,
      polygonMainnet || polygonAmoy => AssetNetwork.polygon,
      _ => null,
    };
  }

  static bool isSupportedCaip(String caip) =>
      supportedEip155Chains.contains(caip);

  static bool isMainnetCaip(String caip) =>
      caip == ethereumMainnet || caip == bnbMainnet || caip == polygonMainnet;

  static bool isSupportedMethod(String method) =>
      supportedEvmMethods.contains(method);

  static bool isUnsafeRejectedMethod(String method) =>
      rejectedUnsafeMethods.contains(method);

  /// Documented unsupported namespaces for reports / UI warnings.
  static const List<String> unsupportedNamespacesDocumented = [
    'bip122 (Bitcoin) — no production WC signing path',
    'tron — no production WC signing path',
    'solana — SDK capable elsewhere; Auvora WC Solana not production-ready yet',
  ];

  static List<String> labelsForCaips(Iterable<String> caips) => [
        for (final c in caips) labelForCaip(c),
      ];
}
