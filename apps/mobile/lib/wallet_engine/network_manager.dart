import 'dart:io';

import 'package:flutter/foundation.dart';

import 'blockchain_adapter.dart';
import 'models.dart';

class NetworkManager extends ChangeNotifier {
  NetworkManager({required BlockchainLayer blockchainLayer}) : _blockchainLayer = blockchainLayer;

  final BlockchainLayer _blockchainLayer;
  final Map<ChainId, EndpointHealth> _health = {};

  bool offline = false;
  DateTime? lastRefreshAt;

  EndpointHealth? statusFor(ChainId chain) => _health[chain];

  List<EndpointHealth> get allStatuses =>
      _health.values.toList()..sort((a, b) => a.chain.index.compareTo(b.chain.index));

  bool get hasDegradedEndpoints => _health.values.any((item) => item.state != EndpointState.healthy);

  Future<void> refresh() async {
    offline = await _detectOffline();
    if (offline) {
      final now = DateTime.now();
      for (final chain in _blockchainLayer.supportedChains) {
        _health[chain] = EndpointHealth(
          chain: chain,
          endpoint: 'offline',
          latencyMs: 0,
          state: EndpointState.offline,
          lastCheckedAt: now,
        );
      }
      lastRefreshAt = now;
      notifyListeners();
      return;
    }
    for (final adapter in _blockchainLayer.adapters) {
      _health[adapter.chain] = await adapter.ping();
    }
    lastRefreshAt = DateTime.now();
    notifyListeners();
  }

  Future<bool> _detectOffline() async {
    if (kIsWeb) return false;
    try {
      final lookup = await InternetAddress.lookup('example.com').timeout(const Duration(seconds: 2));
      return lookup.isEmpty;
    } catch (_) {
      return true;
    }
  }
}
