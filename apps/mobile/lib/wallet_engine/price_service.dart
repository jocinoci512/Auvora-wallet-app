import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

class PriceService {
  PriceService({SharedPreferences? prefs}) : _prefs = prefs;

  SharedPreferences? _prefs;
  Map<String, PricePoint> _cache = {};

  static const _kCache = 'auvora_price_cache_v1';

  static const Map<String, ({double price, double change, List<double> spark})> _seed = {
    'BTC': (
      price: 64210,
      change: 0.84,
      spark: [62800, 63100, 63500, 62900, 64000, 63800, 64210],
    ),
    'ETH': (
      price: 3240.12,
      change: 1.62,
      spark: [3100, 3180, 3150, 3220, 3190, 3260, 3240],
    ),
    'SOL': (
      price: 148.2,
      change: -0.92,
      spark: [152, 150, 149, 151, 147, 146, 148],
    ),
    'USDC': (
      price: 1,
      change: 0.01,
      spark: [1, 1, 1, 1, 1, 1, 1],
    ),
    'USDT': (
      price: 1,
      change: 0.01,
      spark: [1, 1, 1, 1, 1, 1, 1],
    ),
    'POL': (
      price: 0.42,
      change: 2.4,
      spark: [0.38, 0.39, 0.40, 0.41, 0.40, 0.41, 0.42],
    ),
    'BNB': (
      price: 602,
      change: 1.2,
      spark: [588, 590, 592, 596, 598, 600, 602],
    ),
    'TRX': (
      price: 0.135,
      change: 1.8,
      spark: [0.128, 0.129, 0.130, 0.132, 0.133, 0.134, 0.135],
    ),
    'AVAX': (
      price: 28.4,
      change: -1.1,
      spark: [29.2, 28.9, 28.6, 28.8, 28.3, 28.5, 28.4],
    ),
  };

  Future<void> bootstrap() async {
    _prefs ??= await SharedPreferences.getInstance();
    final raw = _prefs?.getString(_kCache);
    if (raw != null && raw.isNotEmpty) {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, Object?>) {
        _cache = decoded.map(
          (key, value) => MapEntry(
            key,
            PricePoint.fromJson((value as Map).cast<String, Object?>()),
          ),
        );
      }
    }
    if (_cache.isEmpty) {
      _cache = {
        for (final entry in _seed.entries)
          entry.key: PricePoint(
            symbol: entry.key,
            priceUsd: entry.value.price,
            change24hPct: entry.value.change,
            sparkline7d: entry.value.spark,
            updatedAt: DateTime.now(),
          ),
      };
      await _persist();
    }
  }

  Future<PricePoint> quote(String symbol, {bool allowStale = true}) async {
    if (_cache.isEmpty) await bootstrap();
    final seed = _cache[symbol] ??
        PricePoint(
          symbol: symbol,
          priceUsd: 1,
          change24hPct: 0,
          sparkline7d: const [1, 1, 1, 1, 1, 1, 1],
          updatedAt: DateTime.now(),
          stale: true,
        );
    final age = DateTime.now().difference(seed.updatedAt);
    if (!allowStale && age > const Duration(hours: 2)) {
      return PricePoint(
        symbol: seed.symbol,
        priceUsd: seed.priceUsd,
        change24hPct: seed.change24hPct,
        sparkline7d: seed.sparkline7d,
        updatedAt: seed.updatedAt,
        stale: true,
      );
    }
    return seed;
  }

  Future<Map<String, PricePoint>> quotes(Iterable<String> symbols) async {
    if (_cache.isEmpty) await bootstrap();
    final out = <String, PricePoint>{};
    for (final symbol in symbols) {
      out[symbol] = await quote(symbol);
    }
    return out;
  }

  Future<void> markOfflineFallback() async {
    if (_cache.isEmpty) await bootstrap();
    _cache = {
      for (final entry in _cache.entries)
        entry.key: PricePoint(
          symbol: entry.value.symbol,
          priceUsd: entry.value.priceUsd,
          change24hPct: entry.value.change24hPct,
          sparkline7d: entry.value.sparkline7d,
          updatedAt: entry.value.updatedAt,
          stale: true,
        ),
    };
    await _persist();
  }

  Future<void> _persist() async {
    _prefs ??= await SharedPreferences.getInstance();
    final raw = jsonEncode({
      for (final entry in _cache.entries) entry.key: entry.value.toJson(),
    });
    await _prefs?.setString(_kCache, raw);
  }
}
