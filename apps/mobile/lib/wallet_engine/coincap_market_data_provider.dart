import 'dart:convert';

import 'package:http/http.dart' as http;

import '../release/integration_config.dart';
import 'models.dart';
import 'market_data_provider.dart';

/// CoinCap public market data — live failover when CoinGecko is unavailable.
///
/// No API key required for basic asset quotes. Optional:
/// `--dart-define=COINCAP_API_KEY=...` → [IntegrationConfig.coinCapApiKey]
class CoinCapMarketDataProvider implements MarketDataProvider {
  CoinCapMarketDataProvider({
    http.Client? client,
    String? apiKey,
  })  : _client = client ?? http.Client(),
        _apiKey = apiKey ?? IntegrationConfig.coinCapApiKey;

  final http.Client _client;
  final String _apiKey;

  static const _ids = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'BNB': 'binance-coin',
    'TRX': 'tron',
    'POL': 'polygon',
    'AVAX': 'avalanche',
    'USDC': 'usd-coin',
    'USDT': 'tether',
  };

  @override
  String get id => 'coincap';

  Map<String, String> get _headers {
    final headers = <String, String>{
      'Accept': 'application/json',
      'User-Agent': 'AuvoraWallet/1.0-alpha (Flutter; Android)',
    };
    if (_apiKey.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_apiKey';
    }
    return headers;
  }

  @override
  Future<Map<String, PricePoint>> fetchQuotes(Iterable<String> symbols) async {
    final wanted = [
      for (final symbol in symbols)
        if (_ids.containsKey(symbol)) symbol,
    ];
    if (wanted.isEmpty) return {};

    final ids = [for (final s in wanted) _ids[s]!].join(',');
    final uri = Uri.parse('https://api.coincap.io/v2/assets?ids=$ids');
    final response = await _client.get(uri, headers: _headers).timeout(const Duration(seconds: 10));
    if (response.statusCode == 429) {
      throw StateError('CoinCap rate limited (429)');
    }
    if (response.statusCode != 200) {
      throw StateError('CoinCap HTTP ${response.statusCode}');
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map) return {};
    final data = decoded['data'];
    if (data is! List) return {};

    final byId = <String, Map>{
      for (final row in data)
        if (row is Map && row['id'] is String) row['id'] as String: row,
    };

    final now = DateTime.now();
    final out = <String, PricePoint>{};
    for (final symbol in wanted) {
      final row = byId[_ids[symbol]!];
      if (row == null) continue;
      final priceRaw = row['priceUsd'];
      final changeRaw = row['changePercent24Hr'];
      final price = priceRaw is String
          ? double.tryParse(priceRaw)
          : (priceRaw as num?)?.toDouble();
      if (price == null || price <= 0) continue;
      final change = changeRaw is String
          ? double.tryParse(changeRaw) ?? 0
          : (changeRaw as num?)?.toDouble() ?? 0;
      out[symbol] = PricePoint(
        symbol: symbol,
        priceUsd: price,
        change24hPct: change,
        sparkline7d: const [],
        updatedAt: now,
        providerId: id,
      );
    }
    if (out.isEmpty) {
      throw StateError('CoinCap returned no usable quotes');
    }
    return out;
  }

  @override
  Future<List<double>> fetchHistory(String symbol, ChartRange range) async {
    final id = _ids[symbol];
    if (id == null) return const [];
    final interval = switch (range) {
      ChartRange.d1 => 'h1',
      ChartRange.d7 => 'h6',
      ChartRange.d30 => 'd1',
      ChartRange.y1 => 'd1',
      ChartRange.all => 'd1',
    };
    final now = DateTime.now().millisecondsSinceEpoch;
    final start = switch (range) {
      ChartRange.d1 => now - const Duration(days: 1).inMilliseconds,
      ChartRange.d7 => now - const Duration(days: 7).inMilliseconds,
      ChartRange.d30 => now - const Duration(days: 30).inMilliseconds,
      ChartRange.y1 => now - const Duration(days: 365).inMilliseconds,
      ChartRange.all => now - const Duration(days: 365 * 3).inMilliseconds,
    };
    final uri = Uri.parse(
      'https://api.coincap.io/v2/assets/$id/history'
      '?interval=$interval&start=$start&end=$now',
    );
    final response = await _client.get(uri, headers: _headers).timeout(const Duration(seconds: 12));
    if (response.statusCode == 429) {
      throw StateError('CoinCap rate limited (429)');
    }
    if (response.statusCode != 200) {
      throw StateError('CoinCap HTTP ${response.statusCode}');
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map) return const [];
    final data = decoded['data'];
    if (data is! List) return const [];
    final values = <double>[
      for (final row in data)
        if (row is Map)
          if (row['priceUsd'] is String)
            double.tryParse(row['priceUsd'] as String) ?? 0
          else if (row['priceUsd'] is num)
            (row['priceUsd'] as num).toDouble(),
    ].where((v) => v > 0).toList();
    if (values.length <= 64) return values;
    final step = (values.length / 64).ceil();
    return [for (var i = 0; i < values.length; i += step) values[i]];
  }
}
