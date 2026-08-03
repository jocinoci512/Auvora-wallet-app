import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';

import '../reliability/retry.dart';
import '../release/integration_config.dart';
import 'blockchain_adapter.dart';
import 'models.dart';
import 'rpc_endpoints.dart';
import 'rpc_health_probe.dart';

/// Closed Beta RPC health with labeled primary→backup failover.
///
/// Endpoint pools come from [RpcEndpoints] (public defaults + dart-define /
/// Alchemy overrides). When [IntegrationConfig.rpcHealthProbeEnabled] is true,
/// NetworkManager probes real tip/RPC URLs for latency. Live broadcast remains
/// gated separately by [ReleaseConfig.liveBroadcastEnabled].
class NetworkManager extends ChangeNotifier {
  NetworkManager({
    required BlockchainLayer blockchainLayer,
    Map<ChainId, List<String>>? backupEndpoints,
    RpcHealthProbe? healthProbe,
  })  : _blockchainLayer = blockchainLayer,
        _backupEndpoints = backupEndpoints ??
            {
              for (final chain in ChainId.values) chain: RpcEndpoints.urlsFor(chain),
            },
        _healthProbe = healthProbe ?? RpcHealthProbe();

  final BlockchainLayer _blockchainLayer;
  final Map<ChainId, List<String>> _backupEndpoints;
  final RpcHealthProbe _healthProbe;
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

  EndpointHealth? statusFor(ChainId chain) => _health[chain];

  List<EndpointHealth> get allStatuses =>
      _health.values.toList()..sort((a, b) => a.chain.index.compareTo(b.chain.index));

  bool get hasDegradedEndpoints => _health.values.any((item) => item.state != EndpointState.healthy);

  bool get cameOnline => previouslyOffline && !offline;

  Future<void> refresh({bool probeEndpoints = true}) async {
    previouslyOffline = offline;
    offline = await _detectOffline();
    final now = DateTime.now();
    healthRefreshCount += 1;

    if (offline) {
      for (final chain in _blockchainLayer.supportedChains) {
        final prior = _health[chain];
        final urls = _backupEndpoints[chain] ?? RpcEndpoints.urlsFor(chain);
        _health[chain] = EndpointHealth(
          chain: chain,
          endpoint: prior?.endpoint ??
              (urls.isEmpty ? 'offline' : RpcEndpoints.displayLabel(urls.first)),
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
    // Connectivity-only path for portfolio critical path — tip probes run via
    // SyncCoordinator periodic / resume / deferred warm-up.
    if (!probeEndpoints) {
      lastRefreshAt = now;
      notifyListeners();
      return;
    }

    // Probe chains in parallel with a hard ceiling so one slow RPC cannot hang
    // portfolio refresh / home restore indefinitely.
    final adapters = _blockchainLayer.adapters.toList(growable: false);
    try {
      final results = await Future.wait([
        for (final adapter in adapters) _pingWithBackup(adapter),
      ]).timeout(const Duration(seconds: 12));
      for (var i = 0; i < adapters.length; i++) {
        _health[adapters[i].chain] = results[i];
      }
    } on TimeoutException {
      timeoutEvents += 1;
      for (final adapter in adapters) {
        if (_health.containsKey(adapter.chain)) continue;
        final urls = _backupEndpoints[adapter.chain] ?? RpcEndpoints.urlsFor(adapter.chain);
        _health[adapter.chain] = EndpointHealth(
          chain: adapter.chain,
          endpoint: urls.isEmpty
              ? 'refresh-timeout'
              : '${RpcEndpoints.displayLabel(urls.first)} (timeout)',
          latencyMs: 0,
          state: EndpointState.degraded,
          lastCheckedAt: DateTime.now(),
          failoverCount: 1,
        );
      }
    }
    lastRefreshAt = now;
    notifyListeners();
  }

  Future<EndpointHealth> _pingWithBackup(BlockchainAdapter adapter) async {
    final labels = _backupEndpoints[adapter.chain] ?? RpcEndpoints.urlsFor(adapter.chain);
    var failovers = 0;

    if (IntegrationConfig.rpcHealthProbeEnabled && labels.isNotEmpty) {
      try {
        final probed = await _healthProbe.probe(adapter.chain);
        if (probed.ok) {
          return EndpointHealth(
            chain: adapter.chain,
            endpoint: probed.endpoint,
            latencyMs: probed.latencyMs,
            state: EndpointState.healthy,
            lastCheckedAt: DateTime.now(),
            failoverCount: 0,
          );
        }
        // Probe miss — fall through to adapter ping + label failover accounting.
        failoverAttempts += 1;
        failovers = 1;
      } catch (_) {
        failoverAttempts += 1;
        failovers = 1;
      }
    }

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
        final degraded = health.state != EndpointState.healthy || i > 0 || failovers > 0;
        return EndpointHealth(
          chain: health.chain,
          endpoint: RpcEndpoints.displayLabel(label),
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
    final miss = labels.isEmpty ? 'rpc-miss' : '${RpcEndpoints.displayLabel(labels.last)}-miss';
    return EndpointHealth(
      chain: adapter.chain,
      endpoint: miss,
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
    // Race DNS — return as soon as either resolver proves reachability.
    // Future.wait would wait for the slower lookup even after the first success.
    if (await _anyDnsReachable()) return false;
    if (await _httpReachable()) return false;
    return true;
  }

  Future<bool> _anyDnsReachable() {
    final done = Completer<bool>();
    var remaining = 2;
    void handle(bool ok) {
      if (done.isCompleted) return;
      if (ok) {
        done.complete(true);
        return;
      }
      remaining -= 1;
      if (remaining == 0) done.complete(false);
    }

    // ignore: discarded_futures
    _dnsReachable('one.one.one.one').then(handle);
    // ignore: discarded_futures
    _dnsReachable('dns.google').then(handle);
    return done.future;
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
        'rpcHealthProbeEnabled': IntegrationConfig.rpcHealthProbeEnabled,
        'integrations': IntegrationConfig.readinessSummary(),
        'endpoints': [
          for (final item in allStatuses)
            {
              'chain': item.chain.key,
              'endpoint': item.endpoint,
              'latencyMs': item.latencyMs,
              'state': item.state.name,
              'failoverCount': item.failoverCount,
              'configuredUrls': [
                for (final u in (_backupEndpoints[item.chain] ?? RpcEndpoints.urlsFor(item.chain)))
                  RpcEndpoints.displayLabel(u),
              ],
            },
        ],
      };
}
