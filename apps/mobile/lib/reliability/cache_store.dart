import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Namespaced local cache with TTL and stale-while-revalidate reads.
class CacheStore {
  CacheStore({SharedPreferences? prefs}) : _prefs = prefs;

  SharedPreferences? _prefs;

  static const prefix = 'auvora_cache_v1:';

  static const nsPortfolio = 'portfolio';
  static const nsTxHistory = 'tx-history';
  static const nsNetworkMeta = 'network-meta';
  static const nsPrices = 'prices';
  static const nsSettingsSafe = 'settings-safe';

  Future<SharedPreferences> _ensure() async {
    return _prefs ??= await SharedPreferences.getInstance();
  }

  String _key(String ns, String id) => '$prefix$ns:$id';

  Future<void> write<T>({
    required String ns,
    required String id,
    required T payload,
    Duration ttl = const Duration(minutes: 30),
    Object? Function(T value)? encode,
  }) async {
    final prefs = await _ensure();
    final encoded = encode != null ? encode(payload) : payload;
    await prefs.setString(
      _key(ns, id),
      jsonEncode({
        'savedAt': DateTime.now().toIso8601String(),
        'ttlMs': ttl.inMilliseconds,
        'payload': encoded,
      }),
    );
  }

  Future<CacheRead<T>?> read<T>({
    required String ns,
    required String id,
    required T Function(Object? raw) decode,
    bool allowStale = true,
  }) async {
    final prefs = await _ensure();
    final raw = prefs.getString(_key(ns, id));
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      final map = Map<String, Object?>.from(decoded);
      final savedAt = DateTime.tryParse((map['savedAt'] as String?) ?? '') ?? DateTime.now();
      final ttlMs = (map['ttlMs'] as num?)?.toInt() ?? 0;
      final age = DateTime.now().difference(savedAt);
      final stale = age.inMilliseconds > ttlMs;
      if (stale && !allowStale) return null;
      return CacheRead(
        data: decode(map['payload']),
        savedAt: savedAt,
        stale: stale,
      );
    } catch (_) {
      return null;
    }
  }

  Future<int> clearNamespace(String ns) async {
    final prefs = await _ensure();
    final needle = '$prefix$ns:';
    final keys = prefs.getKeys().where((k) => k.startsWith(needle)).toList();
    for (final key in keys) {
      await prefs.remove(key);
    }
    return keys.length;
  }

  Future<int> clearAll() async {
    final prefs = await _ensure();
    final keys = prefs.getKeys().where((k) => k.startsWith(prefix)).toList();
    for (final key in keys) {
      await prefs.remove(key);
    }
    // Legacy portfolio key used by SyncEngine before namespaced store.
    await prefs.remove('auvora_portfolio_cache_v2');
    await prefs.remove('auvora_price_cache_v1');
    return keys.length;
  }

  Future<Map<String, int>> namespaceSizes() async {
    final prefs = await _ensure();
    final counts = <String, int>{};
    for (final key in prefs.getKeys()) {
      if (!key.startsWith(prefix)) continue;
      final rest = key.substring(prefix.length);
      final ns = rest.split(':').first;
      counts[ns] = (counts[ns] ?? 0) + 1;
    }
    return counts;
  }
}

class CacheRead<T> {
  const CacheRead({
    required this.data,
    required this.savedAt,
    required this.stale,
  });

  final T data;
  final DateTime savedAt;
  final bool stale;
}
