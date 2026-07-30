import 'dart:io';

import 'package:flutter/foundation.dart';

import '../reliability/retry.dart';
import 'blockchain_adapter.dart';
import 'models.dart';

class NetworkManager extends ChangeNotifier {
  NetworkManager({required BlockchainLayer blockchainLayer}) : _blockchainLayer = blockchainLayer;

  final BlockchainLayer _blockchainLayer;
  final Map<ChainId, EndpointHealth> _health = {};

  bool offline = false;
  bool previouslyOffline = false;
  DateTime? lastRefreshAt;
  DateTime? lastOnlineAt;
  int healthRefreshCount = 0;
  int pingRetries = 0;

  /// Test / diagnostics hook — when set, skips DNS lookup.
  bool? forceOffline;

  EndpointHealth? statusFor(ChainId chain) => _health[chain];

  List<EndpointHealth> get allStatuses =>
      _health.values.toList()..sort((a, b) => a.chain.index.compareTo(b.chain.index));

  bool get hasDegradedEndpoints => _health.values.any((item) => item.state != EndpointState.healthy);

  bool get cameOnline => previouslyOffline && !offline;

  Future<void> refresh() async {
    previouslyOffline = offline;
    offline = await _detectOffline();
    final now = DateTime.now();
    healthRefreshCount += 1;

    if (offline) {
      for (final chain in _blockchainLayer.supportedChains) {
        final prior = _health[chain];
        _health[chain] = EndpointHealth(
          chain: chain,
          endpoint: prior?.endpoint ?? 'offline',
          latencyMs: 0,
          state: EndpointState.offline,
          lastCheckedAt: now,
          failoverCount: prior?.failoverCount ?? 0,
        );
      }
      lastRefreshAt = now;
      notifyListeners();
      return;
    }

    lastOnlineAt = now;
    for (final adapter in _blockchainLayer.adapters) {
      _health[adapter.chain] = await _pingWithBackup(adapter);
    }
    lastRefreshAt = now;
    notifyListeners();
  }

  Future<EndpointHealth> _pingWithBackup(BlockchainAdapter adapter) async {
    try {
      return await withRetry(
        () => adapter.ping(),
        maxAttempts: 2,
        initialDelay: const Duration(milliseconds: 80),
        onRetry: (_, __) => pingRetries += 1,
      );
    } catch (_) {
      final now = DateTime.now();
      return EndpointHealth(
        chain: adapter.chain,
        endpoint: '${adapter.providerCode}-backup-miss',
        latencyMs: 0,
        state: EndpointState.degraded,
        lastCheckedAt: now,
        failoverCount: 1,
      );
    }
  }

  Future<bool> _detectOffline() async {
    if (forceOffline != null) return forceOffline!;
    if (kIsWeb) {
      // Browser navigator.onLine is owned by the web shell; treat as online here.
      return false;
    }
    try {
      final lookup = await InternetAddress.lookup('one.one.one.one').timeout(const Duration(seconds: 2));
      if (lookup.isNotEmpty && lookup.first.rawAddress.isNotEmpty) return false;
      final fallback = await InternetAddress.lookup('dns.google').timeout(const Duration(seconds: 2));
      return fallback.isEmpty || fallback.first.rawAddress.isEmpty;
    } catch (_) {
      try {
        final fallback = await InternetAddress.lookup('dns.google').timeout(const Duration(seconds: 2));
        return fallback.isEmpty;
      } catch (_) {
        return true;
      }
    }
  }

  Map<String, Object?> diagnosticsJson() => {
        'offline': offline,
        'lastRefreshAt': lastRefreshAt?.toIso8601String(),
        'lastOnlineAt': lastOnlineAt?.toIso8601String(),
        'healthRefreshCount': healthRefreshCount,
        'pingRetries': pingRetries,
        'endpoints': [
          for (final item in allStatuses)
            {
              'chain': item.chain.key,
              'endpoint': item.endpoint,
              'latencyMs': item.latencyMs,
              'state': item.state.name,
              'failoverCount': item.failoverCount,
            },
        ],
      };
}
