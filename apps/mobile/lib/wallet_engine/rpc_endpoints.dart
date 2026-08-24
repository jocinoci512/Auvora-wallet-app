import '../release/integration_config.dart';
import '../release/network_env.dart';
import 'models.dart';

/// Configurable RPC / tip-health URL pools for Closed Beta diagnostics.
///
/// Public endpoints work without company accounts. Override via dart-define
/// (`ETH_RPC_URL`, …) or inject Alchemy when `ALCHEMY_API_KEY` is set.
/// Live mainnet broadcast remains gated by [ReleaseConfig.liveBroadcastEnabled].
abstract final class RpcEndpoints {
  /// Ordered failover list per chain (primary first).
  static List<String> urlsFor(ChainId chain) {
    final overrides = _overridesFor(chain).where((u) => u.trim().isNotEmpty).toList();
    final alchemy = _alchemyUrls(chain);
    final public = (AuvoraNetworkEnv.isTestnet ? _publicTestnetDefaults : _publicMainnetDefaults)[chain] ??
        const <String>[];
    final merged = <String>[
      ...overrides,
      ...alchemy.where((u) => !overrides.contains(u)),
      ...public.where((u) => !overrides.contains(u) && !alchemy.contains(u)),
    ];
    return merged;
  }

  static List<String> _overridesFor(ChainId chain) => switch (chain) {
        ChainId.ethereum => [
            IntegrationConfig.ethRpcUrl,
            IntegrationConfig.ethRpcUrlBackup,
          ],
        ChainId.polygon => [
            IntegrationConfig.polygonRpcUrl,
            IntegrationConfig.polygonRpcUrlBackup,
          ],
        ChainId.bnbSmartChain => [
            IntegrationConfig.bscRpcUrl,
            IntegrationConfig.bscRpcUrlBackup,
          ],
        ChainId.solana => [
            IntegrationConfig.solRpcUrl,
            IntegrationConfig.solRpcUrlBackup,
          ],
        ChainId.bitcoin => [
            IntegrationConfig.btcRpcUrl,
            IntegrationConfig.btcRpcUrlBackup,
          ],
        ChainId.tron => [
            IntegrationConfig.tronRpcUrl,
            IntegrationConfig.tronRpcUrlBackup,
          ],
      };

  static List<String> _alchemyUrls(ChainId chain) {
    final key = IntegrationConfig.alchemyApiKey.trim();
    if (key.isEmpty) return const [];
    // Never inject mainnet Alchemy hosts into a TESTNET build.
    if (AuvoraNetworkEnv.isTestnet) {
      return switch (chain) {
        ChainId.ethereum => ['https://eth-sepolia.g.alchemy.com/v2/$key'],
        ChainId.polygon => ['https://polygon-amoy.g.alchemy.com/v2/$key'],
        ChainId.bnbSmartChain => ['https://bnb-testnet.g.alchemy.com/v2/$key'],
        ChainId.solana => ['https://solana-devnet.g.alchemy.com/v2/$key'],
        ChainId.bitcoin => ['https://bitcoin-testnet.g.alchemy.com/v2/$key'],
        ChainId.tron => ['https://tron-nile.g.alchemy.com/v2/$key'],
      };
    }
    return switch (chain) {
      ChainId.ethereum => ['https://eth-mainnet.g.alchemy.com/v2/$key'],
      ChainId.polygon => ['https://polygon-mainnet.g.alchemy.com/v2/$key'],
      ChainId.bnbSmartChain => ['https://bnb-mainnet.g.alchemy.com/v2/$key'],
      ChainId.solana => ['https://solana-mainnet.g.alchemy.com/v2/$key'],
      ChainId.bitcoin => ['https://bitcoin-mainnet.g.alchemy.com/v2/$key'],
      ChainId.tron => ['https://tron-mainnet.g.alchemy.com/v2/$key'],
    };
  }

  static const Map<ChainId, List<String>> _publicMainnetDefaults = {
    ChainId.ethereum: [
      'https://ethereum.publicnode.com',
      'https://cloudflare-eth.com',
      'https://rpc.ankr.com/eth',
    ],
    ChainId.polygon: [
      'https://polygon-bor.publicnode.com',
      'https://polygon-rpc.com',
      'https://rpc.ankr.com/polygon',
    ],
    ChainId.bnbSmartChain: [
      'https://bsc.publicnode.com',
      'https://binance.llamarpc.com',
      'https://rpc.ankr.com/bsc',
    ],
    ChainId.solana: [
      'https://api.mainnet-beta.solana.com',
      'https://solana-rpc.publicnode.com',
    ],
    ChainId.bitcoin: [
      'https://mempool.space/api/blocks/tip/height',
      'https://blockstream.info/api/blocks/tip/height',
    ],
    ChainId.tron: [
      'https://api.trongrid.io',
      'https://tron-rpc.publicnode.com',
    ],
  };

  static const Map<ChainId, List<String>> _publicTestnetDefaults = {
    ChainId.ethereum: [
      'https://ethereum-sepolia.publicnode.com',
      'https://rpc.sepolia.org',
    ],
    ChainId.polygon: [
      'https://rpc-amoy.polygon.technology',
      'https://polygon-amoy.publicnode.com',
    ],
    ChainId.bnbSmartChain: [
      'https://bsc-testnet.publicnode.com',
      'https://data-seed-prebsc-1-s1.binance.org:8545',
    ],
    ChainId.solana: [
      'https://api.devnet.solana.com',
    ],
    ChainId.bitcoin: [
      'https://mempool.space/testnet/api/blocks/tip/height',
      'https://blockstream.info/testnet/api/blocks/tip/height',
    ],
    ChainId.tron: [
      'https://nile.trongrid.io',
    ],
  };

  /// Safe label for diagnostics (redacts Alchemy path segments).
  static String displayLabel(String url) {
    try {
      final uri = Uri.parse(url);
      if (uri.pathSegments.contains('v2') && uri.pathSegments.length >= 2) {
        final host = uri.host;
        return '$host/v2/••••';
      }
      return url.length > 64 ? '${url.substring(0, 61)}…' : url;
    } catch (_) {
      return 'rpc';
    }
  }

  /// Fail closed: detect mainnet host markers (for QA tests / guards).
  static bool looksLikeMainnetUrl(String url) {
    final lower = url.toLowerCase();
    const markers = [
      'eth-mainnet',
      'polygon-mainnet',
      'bnb-mainnet',
      'solana-mainnet',
      'tron-mainnet',
      'bitcoin-mainnet',
      'mainnet-beta.solana.com',
      'api.trongrid.io',
      'cloudflare-eth.com',
      'ethereum.publicnode.com',
    ];
    if (lower.contains('mempool.space') && !lower.contains('/testnet')) return true;
    if (lower.contains('blockstream.info') && !lower.contains('/testnet')) return true;
    return markers.any(lower.contains);
  }
}
