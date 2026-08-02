import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../reliability/cache_store.dart';
import 'alchemy_prices_market_data_provider.dart';
import 'coincap_market_data_provider.dart';
import 'coingecko_market_data_provider.dart';
import 'market_data_provider.dart';
import 'models.dart';
import 'seeded_market_data_provider.dart';

class PriceService {
  PriceService({
    SharedPreferences? prefs,
    List<MarketDataProvider>? providers,
    CacheStore? cacheStore,
    this.refreshInterval = const Duration(minutes: 2),
  })  : _prefs = prefs,
        _cacheStore = cacheStore ?? CacheStore(prefs: prefs),
        _providers = providers ??
            [
              CoinGeckoMarketDataProvider(),
              CoinCapMarketDataProvider(),
              AlchemyPricesMarketDataProvider(),
              SeededMarketDataProvider(),
            ];

  SharedPreferences? _prefs;
  final CacheStore _cacheStore;
  final List<MarketDataProvider> _providers;
  final Duration refreshInterval;
  Map<String, PricePoint> _cache = {};
  String? activeProviderId;
  DateTime? lastSuccessfulRefreshAt;
  String? lastRefreshError;
  DateTime? _lastRefreshAttemptAt;
  final Map<String, Map<ChartRange, List<double>>> _history = {};

  static const _kCache = 'auvora_price_cache_v1';
  static const _minRefreshGap = Duration(seconds: 20);

  bool get usingLiveProvider =>
      activeProviderId != null &&
      activeProviderId != 'seeded-offline' &&
      activeProviderId != 'cached';

  /// Human-readable active source for diagnostics / Home badges.
  String get priceSourceLabel {
    switch (activeProviderId) {
      case 'coingecko':
        return 'CoinGecko (live)';
      case 'coincap':
        return 'CoinCap (failover)';
      case 'alchemy-prices':
        return 'Alchemy Prices (failover)';
      case 'seeded-offline':
        return 'Demo / seeded';
      case null:
        return _cache.isEmpty ? 'Unavailable' : 'Cached last-known';
      default:
        return activeProviderId!;
    }
  }

  bool get showingStaleOrDemo {
    if (activeProviderId == 'seeded-offline') return true;
    if (usingLiveProvider) return false;
    if (_cache.values.any((p) => p.stale)) return true;
    return _cache.isNotEmpty;
  }

  bool get cacheNeedsRefresh {
    if (_cache.isEmpty) return true;
    final anchor = lastSuccessfulRefreshAt ??
        _cache.values.map((p) => p.updatedAt).fold<DateTime?>(null, (best, at) {
          if (best == null || at.isBefore(best)) return at;
          return best;
        });
    if (anchor == null) return true;
    return DateTime.now().difference(anchor) > refreshInterval;
  }

  Future<void> bootstrap() async {
    _prefs ??= await SharedPreferences.getInstance();
    final namespaced = await _cacheStore.read<Map<String, Object?>>(
      ns: CacheStore.nsPrices,
      id: 'quotes',
      decode: (raw) => Map<String, Object?>.from(raw as Map),
      allowStale: true,
    );
    if (namespaced != null) {
      _cache = {
        for (final entry in namespaced.data.entries)
          if (entry.value is Map)
            entry.key: PricePoint.fromJson(Map<String, Object?>.from(entry.value as Map)),
      };
    }
    final raw = _prefs?.getString(_kCache);
    if (_cache.isEmpty && raw != null && raw.isNotEmpty) {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        _cache = {
          for (final entry in decoded.entries)
            if (entry.value is Map)
              entry.key.toString(): PricePoint.fromJson(
                Map<String, Object?>.from(entry.value as Map),
              ),
        };
      }
    }
    if (_cache.isEmpty) {
      final seed = await SeededMarketDataProvider().fetchQuotes(SeededMarketDataProvider.seed.keys);
      _cache = {
        for (final e in seed.entries)
          e.key: PricePoint(
            symbol: e.value.symbol,
            priceUsd: e.value.priceUsd,
            change24hPct: e.value.change24hPct,
            sparkline7d: e.value.sparkline7d,
            updatedAt: e.value.updatedAt,
            stale: true,
            providerId: 'seeded-offline',
          ),
      };
      activeProviderId = 'seeded-offline';
      await _persist();
    }
    await refreshQuotes(_cache.keys);
  }

  Future<void> refreshQuotes(Iterable<String> symbols, {bool force = false}) async {
    final now = DateTime.now();
    if (!force &&
        _lastRefreshAttemptAt != null &&
        now.difference(_lastRefreshAttemptAt!) < _minRefreshGap &&
        !cacheNeedsRefresh) {
      return;
    }
    _lastRefreshAttemptAt = now;

    final list = symbols.isEmpty ? SeededMarketDataProvider.seed.keys : symbols;
    Object? lastError;
    for (final provider in _providers) {
      try {
        final quotes = await provider.fetchQuotes(list);
        if (quotes.isEmpty) continue;
        activeProviderId = provider.id;
        lastRefreshError = null;
        lastSuccessfulRefreshAt = DateTime.now();
        // Seeded is demo-only when live providers exist and we failed over to seed.
        final seededFallback =
            provider.id == 'seeded-offline' && _providers.any((p) => p.id != 'seeded-offline');
        for (final entry in quotes.entries) {
          final prior = _cache[entry.key];
          _cache[entry.key] = PricePoint(
            symbol: entry.value.symbol,
            priceUsd: entry.value.priceUsd,
            change24hPct: entry.value.change24hPct,
            sparkline7d: entry.value.sparkline7d.isNotEmpty
                ? entry.value.sparkline7d
                : (prior?.sparkline7d ?? const [1, 1, 1, 1, 1, 1, 1]),
            updatedAt: entry.value.updatedAt,
            stale: seededFallback || entry.value.stale,
            providerId: provider.id,
          );
        }
        await _persist();
        return;
      } catch (error) {
        lastError = error;
        // Try next provider.
      }
    }
    lastRefreshError = lastError?.toString() ?? 'Price providers unavailable';
    // Keep last-known cache (stale) rather than wiping.
    await markOfflineFallback();
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
    final tooOld = age > const Duration(minutes: 15);
    if ((!allowStale && age > const Duration(hours: 2)) || tooOld || seed.stale) {
      return PricePoint(
        symbol: seed.symbol,
        priceUsd: seed.priceUsd,
        change24hPct: seed.change24hPct,
        sparkline7d: seed.sparkline7d,
        updatedAt: seed.updatedAt,
        stale: true,
        providerId: seed.providerId,
      );
    }
    return seed;
  }

  Future<Map<String, PricePoint>> quotes(
    Iterable<String> symbols, {
    bool forceRefresh = false,
  }) async {
    if (_cache.isEmpty) await bootstrap();
    if (forceRefresh || cacheNeedsRefresh) {
      await refreshQuotes(symbols, force: forceRefresh);
    }
    final out = <String, PricePoint>{};
    for (final symbol in symbols) {
      out[symbol] = await quote(symbol);
    }
    return out;
  }

  Future<List<double>> history(String symbol, ChartRange range) async {
    final cached = _history[symbol]?[range];
    if (cached != null && cached.isNotEmpty) return cached;

    for (final provider in _providers) {
      try {
        final series = await provider.fetchHistory(symbol, range);
        if (series.isEmpty) continue;
        (_history[symbol] ??= {})[range] = series;
        activeProviderId = provider.id;
        return series;
      } catch (_) {
        // failover
      }
    }
    final fallback = await SeededMarketDataProvider().fetchHistory(symbol, range);
    (_history[symbol] ??= {})[range] = fallback;
    return fallback;
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
          providerId: entry.value.providerId,
        ),
    };
    await _persist();
  }

  Future<void> _persist() async {
    _prefs ??= await SharedPreferences.getInstance();
    final map = {
      for (final entry in _cache.entries) entry.key: entry.value.toJson(),
    };
    final raw = jsonEncode(map);
    await _prefs?.setString(_kCache, raw);
    await _cacheStore.write(
      ns: CacheStore.nsPrices,
      id: 'quotes',
      payload: map,
      ttl: const Duration(minutes: 45),
    );
  }
}
