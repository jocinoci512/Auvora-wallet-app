import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';
import 'market_data_provider.dart';

/// CoinGecko simple price + market_chart provider. Fails soft on network errors.
class CoinGeckoMarketDataProvider implements MarketDataProvider {
  CoinGeckoMarketDataProvider({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  static const _ids = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'BNB': 'binancecoin',
    'TRX': 'tron',
    'POL': 'polygon-ecosystem-token',
    'AVAX': 'avalanche-2',
    'USDC': 'usd-coin',
    'USDT': 'tether',
  };

  @override
  String get id => 'coingecko';

  @override
  Future<Map<String, PricePoint>> fetchQuotes(Iterable<String> symbols) async {
    final wanted = [
      for (final symbol in symbols)
        if (_ids.containsKey(symbol)) symbol,
    ];
    if (wanted.isEmpty) return {};

    final ids = [for (final s in wanted) _ids[s]!].join(',');
    final uri = Uri.parse(
      'https://api.coingecko.com/api/v3/simple/price'
      '?ids=$ids&vs_currencies=usd&include_24hr_change=true',
    );
    final response = await _client.get(uri).timeout(const Duration(seconds: 8));
    if (response.statusCode != 200) return {};
    final decoded = jsonDecode(response.body);
    if (decoded is! Map) return {};

    final now = DateTime.now();
    final out = <String, PricePoint>{};
    for (final symbol in wanted) {
      final id = _ids[symbol]!;
      final row = decoded[id];
      if (row is! Map) continue;
      final price = (row['usd'] as num?)?.toDouble();
      if (price == null) continue;
      final change = (row['usd_24h_change'] as num?)?.toDouble() ?? 0;
      out[symbol] = PricePoint(
        symbol: symbol,
        priceUsd: price,
        change24hPct: change,
        sparkline7d: const [],
        updatedAt: now,
      );
    }
    return out;
  }

  @override
  Future<List<double>> fetchHistory(String symbol, ChartRange range) async {
    final id = _ids[symbol];
    if (id == null) return const [];
    final days = switch (range) {
      ChartRange.d1 => '1',
      ChartRange.d7 => '7',
      ChartRange.d30 => '30',
      ChartRange.y1 => '365',
      ChartRange.all => 'max',
    };
    final uri = Uri.parse(
      'https://api.coingecko.com/api/v3/coins/$id/market_chart'
      '?vs_currency=usd&days=$days',
    );
    final response = await _client.get(uri).timeout(const Duration(seconds: 10));
    if (response.statusCode != 200) return const [];
    final decoded = jsonDecode(response.body);
    if (decoded is! Map) return const [];
    final prices = decoded['prices'];
    if (prices is! List) return const [];
    final values = <double>[
      for (final row in prices)
        if (row is List && row.length >= 2) (row[1] as num).toDouble(),
    ];
    if (values.length <= 64) return values;
    // Downsample for chart rendering.
    final step = (values.length / 64).ceil();
    return [for (var i = 0; i < values.length; i += step) values[i]];
  }
}
