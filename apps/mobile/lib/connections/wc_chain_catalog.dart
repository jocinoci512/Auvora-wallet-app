/// CAIP-2 chain catalog for WalletConnect / Reown session namespaces.
///
/// Only advertise capabilities Auvora can honor on-device. Do **not** fake
/// Bitcoin, Tron, or Solana WalletConnect support until production-capable.
library;

import '../portfolio/models.dart';

/// Supported WalletConnect namespaces for Auvora (EVM only in this sprint).
abstract final class WcChainCatalog {
  static const String ethereum = 'eip155:1';
  static const String bnbSmartChain = 'eip155:56';
  static const String polygon = 'eip155:137';

  /// Chains we register with Reown WalletKit.
  static const List<String> supportedEip155Chains = [
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
      ethereum => 'ETHEREUM',
      bnbSmartChain => 'BNB_SMART_CHAIN',
      polygon => 'POLYGON',
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
      ethereum => AssetNetwork.ethereum,
      bnbSmartChain => AssetNetwork.bnbSmartChain,
      polygon => AssetNetwork.polygon,
      _ => null,
    };
  }

  static bool isSupportedCaip(String caip) =>
      supportedEip155Chains.contains(caip);

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
