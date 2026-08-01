import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';

import '../reliability/retry.dart';
import 'blockchain_adapter.dart';
import 'models.dart';

/// Preview / Closed Beta RPC health with labeled primary→backup failover.
///
/// Real multi-URL RPC pools land when live broadcast is enabled; until then
/// adapters report simulated endpoints and NetworkManager tracks failover attempts.
class NetworkManager extends ChangeNotifier {
  NetworkManager({
    required BlockchainLayer blockchainLayer,
    Map<ChainId, List<String>>? backupEndpoints,
  })  : _blockchainLayer = blockchainLayer,
        _backupEndpoints = backupEndpoints ?? _defaultBackups;

  final BlockchainLayer _blockchainLayer;
  final Map<ChainId, List<String>> _backupEndpoints;
  final Map<ChainId, EndpointHealth> _health = {};

  bool offline = false;
  bool previouslyOffline = false;
  DateTime? lastRefreshAt;
  DateTime? lastOnlineAt;
  int healthRefreshCount = 0;
  int pingRetries = 0;
  int failoverAttempts = 0;
  int timeoutEvents = 0;

  /// Test / diagnostics hook — when set, skips DNS lookup.
  bool? forceOffline;

  static final Map<ChainId, List<String>> _defaultBackups = {
    for (final chain in ChainId.values)
      chain: [
        '${chain.key}-rpc-primary.preview',
        '${chain.key}-rpc-backup.preview',
        '${chain.key}-rpc-fallback.preview',
      ],
  };

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
    final labels = _backupEndpoints[adapter.chain] ??
        ['${adapter.providerCode}-primary', '${adapter.providerCode}-backup'];
    var failovers = 0;
    Object? lastError;

    for (var i = 0; i < labels.length; i++) {
      final label = labels[i];
      try {
        final health = await withRetry(
          () => adapter.ping().timeout(const Duration(seconds: 3)),
          maxAttempts: i == 0 ? 2 : 1,
          initialDelay: const Duration(milliseconds: 80),
          onRetry: (_, __) => pingRetries += 1,
        );
        if (i > 0) {
          failoverAttempts += 1;
          failovers = i;
        }
        final degraded = health.state != EndpointState.healthy || i > 0;
        return EndpointHealth(
          chain: health.chain,
          endpoint: i == 0 ? health.endpoint : '$label (failover)',
          latencyMs: health.latencyMs,
          state: degraded ? EndpointState.degraded : EndpointState.healthy,
          lastCheckedAt: DateTime.now(),
          failoverCount: (health.failoverCount) + failovers,
        );
      } on TimeoutException {
        timeoutEvents += 1;
        lastError = TimeoutException('rpc ping timeout');
        failoverAttempts += 1;
        failovers = i + 1;
      } catch (error) {
        lastError = error;
        failoverAttempts += 1;
        failovers = i + 1;
      }
    }

    assert(lastError != null || failovers > 0);
    final now = DateTime.now();
    return EndpointHealth(
      chain: adapter.chain,
      endpoint: '${labels.last}-miss',
      latencyMs: 0,
      state: EndpointState.degraded,
      lastCheckedAt: now,
      failoverCount: failovers,
    );
  }

  Future<bool> _detectOffline() async {
    if (forceOffline != null) return forceOffline!;
    if (kIsWeb) {
      // Browser navigator.onLine is owned by the web shell; treat as online here.
      return false;
    }
    // Prefer DNS, then HTTPS probe — some Android carriers/VPNs break lookup alone.
    if (await _dnsReachable('one.one.one.one')) return false;
    if (await _dnsReachable('dns.google')) return false;
    if (await _httpReachable()) return false;
    return true;
  }

  Future<bool> _dnsReachable(String host) async {
    try {
      final lookup = await InternetAddress.lookup(host).timeout(const Duration(seconds: 2));
      return lookup.isNotEmpty && lookup.first.rawAddress.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<bool> _httpReachable() async {
    try {
      final client = HttpClient()..connectionTimeout = const Duration(seconds: 3);
      try {
        final request = await client
            .getUrl(Uri.parse('https://connectivitycheck.gstatic.com/generate_204'))
            .timeout(const Duration(seconds: 3));
        request.followRedirects = false;
        final response = await request.close().timeout(const Duration(seconds: 3));
        await response.drain<void>();
        // 204 is ideal; any response means the device has a working network path.
        return response.statusCode >= 200 && response.statusCode < 500;
      } finally {
        client.close(force: true);
      }
    } catch (_) {
      return false;
    }
  }

  Map<String, Object?> diagnosticsJson() => {
        'offline': offline,
        'lastRefreshAt': lastRefreshAt?.toIso8601String(),
        'lastOnlineAt': lastOnlineAt?.toIso8601String(),
        'healthRefreshCount': healthRefreshCount,
        'pingRetries': pingRetries,
        'failoverAttempts': failoverAttempts,
        'timeoutEvents': timeoutEvents,
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
