import '../release/integration_config.dart';
import 'models.dart';

/// Configurable RPC / tip-health URL pools for Closed Beta diagnostics.
///
/// Public endpoints work without company accounts. Override via dart-define
/// (`ETH_RPC_URL`, …) or inject Alchemy when `ALCHEMY_API_KEY` is set.
/// Live transaction broadcast remains gated by [ReleaseConfig.liveBroadcastEnabled].
abstract final class RpcEndpoints {
  /// Ordered failover list per chain (primary first).
  static List<String> urlsFor(ChainId chain) {
    final overrides = _overridesFor(chain).where((u) => u.trim().isNotEmpty).toList();
    final alchemy = _alchemyUrls(chain);
    final public = _publicDefaults[chain] ?? const <String>[];
    // Prefer explicit overrides, then Alchemy (if keyed), then public defaults.
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
    return switch (chain) {
      ChainId.ethereum => ['https://eth-mainnet.g.alchemy.com/v2/$key'],
      ChainId.polygon => ['https://polygon-mainnet.g.alchemy.com/v2/$key'],
      ChainId.bnbSmartChain => [
          // Alchemy BSC requires enabled app; fall through to public if unused.
          'https://bnb-mainnet.g.alchemy.com/v2/$key',
        ],
      ChainId.solana => ['https://solana-mainnet.g.alchemy.com/v2/$key'],
      ChainId.bitcoin => const [],
      ChainId.tron => const [],
    };
  }

  /// Well-known public endpoints — no API key required.
  /// Rate limits apply; treat as best-effort for health probes and future live paths.
  static const Map<ChainId, List<String>> _publicDefaults = {
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
    // REST tip endpoints (not JSON-RPC) — used for health probes only.
    ChainId.bitcoin: [
      'https://mempool.space/api/blocks/tip/height',
      'https://blockstream.info/api/blocks/tip/height',
    ],
    ChainId.tron: [
      'https://api.trongrid.io',
      'https://tron-rpc.publicnode.com',
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
}
