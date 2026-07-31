import 'models.dart';
import 'market_data_provider.dart';

/// Offline / Closed Beta seed quotes used as last-resort failover.
class SeededMarketDataProvider implements MarketDataProvider {
  @override
  String get id => 'seeded-offline';

  static const Map<String, ({double price, double change, List<double> spark})> seed = {
    'BTC': (price: 64210, change: 0.84, spark: [62800, 63100, 63500, 62900, 64000, 63800, 64210]),
    'ETH': (price: 3240.12, change: 1.62, spark: [3100, 3180, 3150, 3220, 3190, 3260, 3240]),
    'SOL': (price: 148.2, change: -0.92, spark: [152, 150, 149, 151, 147, 146, 148]),
    'USDC': (price: 1, change: 0.01, spark: [1, 1, 1, 1, 1, 1, 1]),
    'USDT': (price: 1, change: 0.01, spark: [1, 1, 1, 1, 1, 1, 1]),
    'POL': (price: 0.42, change: 2.4, spark: [0.38, 0.39, 0.40, 0.41, 0.40, 0.41, 0.42]),
    'BNB': (price: 602, change: 1.2, spark: [588, 590, 592, 596, 598, 600, 602]),
    'TRX': (price: 0.135, change: 1.8, spark: [0.128, 0.129, 0.130, 0.132, 0.133, 0.134, 0.135]),
    'AVAX': (price: 28.4, change: -1.1, spark: [29.2, 28.9, 28.6, 28.8, 28.3, 28.5, 28.4]),
  };

  @override
  Future<Map<String, PricePoint>> fetchQuotes(Iterable<String> symbols) async {
    final now = DateTime.now();
    final out = <String, PricePoint>{};
    for (final symbol in symbols) {
      final entry = seed[symbol];
      if (entry == null) continue;
      out[symbol] = PricePoint(
        symbol: symbol,
        priceUsd: entry.price,
        change24hPct: entry.change,
        sparkline7d: entry.spark,
        updatedAt: now,
      );
    }
    return out;
  }

  @override
  Future<List<double>> fetchHistory(String symbol, ChartRange range) async {
    final spark = seed[symbol]?.spark ?? const [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
    final points = switch (range) {
      ChartRange.d1 => 24,
      ChartRange.d7 => 7,
      ChartRange.d30 => 30,
      ChartRange.y1 => 52,
      ChartRange.all => 64,
    };
    if (spark.length >= points) return spark.take(points).toList(growable: false);
    final out = <double>[];
    final base = spark.first;
    final end = spark.last;
    for (var i = 0; i < points; i++) {
      final t = i / (points - 1);
      final wobble = ((i % 5) - 2) * (end * 0.002);
      out.add(base + (end - base) * t + wobble);
    }
    return out;
  }
}
