import 'models.dart';

class AssetRegistry {
  AssetRegistry() : _assets = {
    for (final asset in _defaultAssets) asset.id: asset,
  };

  final Map<String, AssetDefinition> _assets;

  static const _defaultAssets = [
    AssetDefinition(
      id: 'btc',
      symbol: 'BTC',
      displayName: 'Bitcoin',
      decimals: 8,
      networks: [ChainId.bitcoin],
      iconKey: 'btc',
    ),
    AssetDefinition(
      id: 'eth',
      symbol: 'ETH',
      displayName: 'Ethereum',
      decimals: 18,
      networks: [ChainId.ethereum],
      iconKey: 'eth',
    ),
    AssetDefinition(
      id: 'sol',
      symbol: 'SOL',
      displayName: 'Solana',
      decimals: 9,
      networks: [ChainId.solana],
      iconKey: 'sol',
    ),
    AssetDefinition(
      id: 'bnb',
      symbol: 'BNB',
      displayName: 'BNB',
      decimals: 18,
      networks: [ChainId.bnbSmartChain],
      iconKey: 'bnb',
    ),
    AssetDefinition(
      id: 'trx',
      symbol: 'TRX',
      displayName: 'Tron',
      decimals: 6,
      networks: [ChainId.tron],
      iconKey: 'trx',
    ),
    AssetDefinition(
      id: 'pol',
      symbol: 'POL',
      displayName: 'Polygon',
      decimals: 18,
      networks: [ChainId.polygon],
      iconKey: 'pol',
    ),
    AssetDefinition(
      id: 'usdc-eth',
      symbol: 'USDC',
      displayName: 'USD Coin',
      decimals: 6,
      networks: [ChainId.ethereum, ChainId.solana, ChainId.polygon],
      contractAddress: 'preview-usdc',
      iconKey: 'usdc',
      isStable: true,
    ),
    AssetDefinition(
      id: 'usdt',
      symbol: 'USDT',
      displayName: 'Tether',
      decimals: 6,
      networks: [ChainId.ethereum, ChainId.bnbSmartChain, ChainId.tron],
      contractAddress: 'preview-usdt',
      iconKey: 'usdt',
      isStable: true,
    ),
    AssetDefinition(
      id: 'avax',
      symbol: 'AVAX',
      displayName: 'Avalanche',
      decimals: 18,
      networks: [ChainId.ethereum],
      contractAddress: 'preview-avax',
      iconKey: 'avax',
    ),
  ];

  List<AssetDefinition> get all => _assets.values.toList(growable: false);

  AssetDefinition? byId(String id) => _assets[id];

  String holdingId(AssetDefinition asset, ChainId chain) => '${asset.id}:${chain.key}';

  List<AssetDefinition> forChain(ChainId chain) =>
      all.where((asset) => asset.networks.contains(chain)).toList(growable: false);

  AssetDefinition? bySymbolOnChain(String symbol, ChainId chain) {
    final upper = symbol.toUpperCase();
    for (final asset in all) {
      if (asset.symbol == upper && asset.networks.contains(chain)) return asset;
    }
    return null;
  }
}
