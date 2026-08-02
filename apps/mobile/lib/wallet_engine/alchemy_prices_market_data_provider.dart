import 'dart:convert';

import 'package:http/http.dart' as http;

import '../release/integration_config.dart';
import 'models.dart';
import 'market_data_provider.dart';

/// Alchemy Prices API — tertiary failover after CoinGecko / CoinCap.
///
/// Requires [IntegrationConfig.alchemyApiKey] via `--dart-define` (dev only).
/// Alpha release APKs must **not** bake the server Alchemy key into the binary;
/// when the key is empty this provider fails immediately so PriceService skips it.
///
/// Endpoint: `GET https://api.g.alchemy.com/prices/v1/{apiKey}/tokens/by-symbol`
class AlchemyPricesMarketDataProvider implements MarketDataProvider {
  AlchemyPricesMarketDataProvider({
    http.Client? client,
    String? apiKey,
  })  : _client = client ?? http.Client(),
        _apiKey = (apiKey ?? IntegrationConfig.alchemyApiKey).trim();

  final http.Client _client;
  final String _apiKey;

  /// Symbols Alchemy Prices understands for Auvora's supported assets.
  static const _symbols = {
    'BTC',
    'ETH',
    'SOL',
    'BNB',
    'TRX',
    'POL',
    'AVAX',
    'USDC',
    'USDT',
  };

  @override
  String get id => 'alchemy-prices';

  bool get isConfigured => _apiKey.isNotEmpty;

  @override
  Future<Map<String, PricePoint>> fetchQuotes(Iterable<String> symbols) async {
    if (!isConfigured) {
      throw StateError('Alchemy Prices unavailable (no client key — use backend/proxy)');
    }
    final wanted = [
      for (final symbol in symbols)
        if (_symbols.contains(symbol)) symbol,
    ];
    if (wanted.isEmpty) return {};

    final params = <String>[];
    for (final s in wanted) {
      params.add('symbols=${Uri.encodeQueryComponent(s)}');
    }
    final uri = Uri.parse(
      'https://api.g.alchemy.com/prices/v1/$_apiKey/tokens/by-symbol?${params.join('&')}',
    );
    final response = await _client
        .get(uri, headers: {
          'Accept': 'application/json',
          'User-Agent': 'AuvoraWallet/1.0-alpha (Flutter; Android)',
        })
        .timeout(const Duration(seconds: 10));
    if (response.statusCode == 429) {
      throw StateError('Alchemy Prices rate limited (429)');
    }
    if (response.statusCode == 401 || response.statusCode == 403) {
      throw StateError('Alchemy Prices auth failed (${response.statusCode})');
    }
    if (response.statusCode != 200) {
      throw StateError('Alchemy Prices HTTP ${response.statusCode}');
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map) return {};
    final data = decoded['data'];
    if (data is! List) return {};

    final now = DateTime.now();
    final out = <String, PricePoint>{};
    for (final row in data) {
      if (row is! Map) continue;
      final symbol = (row['symbol'] as String?)?.toUpperCase();
      if (symbol == null || !_symbols.contains(symbol)) continue;
      final prices = row['prices'];
      if (prices is! List || prices.isEmpty) continue;
      Map? usd;
      for (final p in prices) {
        if (p is Map &&
            (p['currency'] as String?)?.toLowerCase() == 'usd') {
          usd = p;
          break;
        }
      }
      usd ??= prices.first is Map ? prices.first as Map : null;
      if (usd == null) continue;
      final raw = usd['value'];
      final price = raw is String
          ? double.tryParse(raw)
          : (raw as num?)?.toDouble();
      if (price == null || price <= 0) continue;
      DateTime updated = now;
      final stamp = usd['lastUpdatedAt'];
      if (stamp is String) {
        updated = DateTime.tryParse(stamp) ?? now;
      }
      out[symbol] = PricePoint(
        symbol: symbol,
        priceUsd: price,
        change24hPct: 0,
        sparkline7d: const [],
        updatedAt: updated,
        providerId: id,
      );
    }
    if (out.isEmpty) {
      throw StateError('Alchemy Prices returned no usable quotes');
    }
    return out;
  }

  @override
  Future<List<double>> fetchHistory(String symbol, ChartRange range) async {
    // Historical Prices API is available but not required for Alpha failover.
    return const [];
  }
}
