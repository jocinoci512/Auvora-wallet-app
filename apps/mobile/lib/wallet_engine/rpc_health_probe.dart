import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../release/integration_config.dart';
import 'models.dart';
import 'rpc_endpoints.dart';

/// Lightweight tip / JSON-RPC health probe against [RpcEndpoints].
///
/// Used by [NetworkManager] when [IntegrationConfig.rpcHealthProbeEnabled] is
/// true. Does not broadcast transactions.
class RpcHealthProbe {
  RpcHealthProbe({HttpClient? client}) : _client = client;

  final HttpClient? _client;

  Future<({String endpoint, int latencyMs, bool ok})> probe(ChainId chain) async {
    if (!IntegrationConfig.rpcHealthProbeEnabled) {
      return (endpoint: 'probe-disabled', latencyMs: 0, ok: false);
    }
    final urls = RpcEndpoints.urlsFor(chain);
    Object? lastError;
    final client = _client ?? (HttpClient()..connectionTimeout = const Duration(seconds: 3));
    final owned = _client == null;
    try {
      for (final url in urls) {
        final sw = Stopwatch()..start();
        try {
          final ok = await _probeUrl(chain, url, client).timeout(const Duration(seconds: 4));
          sw.stop();
          if (ok) {
            return (
              endpoint: RpcEndpoints.displayLabel(url),
              latencyMs: sw.elapsedMilliseconds,
              ok: true,
            );
          }
        } catch (e) {
          lastError = e;
        }
      }
    } finally {
      if (owned) client.close(force: true);
    }
    assert(lastError != null || urls.isNotEmpty);
    final fallback = urls.isEmpty ? 'none' : RpcEndpoints.displayLabel(urls.first);
    return (endpoint: '$fallback (unreachable)', latencyMs: 0, ok: false);
  }

  Future<bool> _probeUrl(ChainId chain, String url, HttpClient client) async {
    switch (chain) {
      case ChainId.bitcoin:
        // Alchemy Bitcoin is JSON-RPC; Mempool/Blockstream tip probes are REST.
        if (url.contains('alchemy.com')) {
          return _jsonRpc(client, url, 'getblockcount', const []);
        }
        return _getOk(client, url);
      case ChainId.tron:
        // TronGrid base → getnowblock; Alchemy / publicnode may speak JSON-RPC.
        if (url.contains('trongrid')) {
          return _getOk(client, '$url/wallet/getnowblock');
        }
        return _jsonRpc(client, url, 'eth_blockNumber', const []);
      case ChainId.solana:
        // getHealth is enough for tip connectivity; blockhash is checked at
        // send-time, not on every cold-start probe.
        return _jsonRpc(client, url, 'getHealth', const []);
      case ChainId.ethereum:
      case ChainId.polygon:
      case ChainId.bnbSmartChain:
        // Tip height is sufficient for connectivity; gas/balance are optional
        // read-only checks elsewhere and must never block wallet restore.
        return _jsonRpc(client, url, 'eth_blockNumber', const []);
    }
  }

  Future<bool> _getOk(HttpClient client, String url) async {
    final request = await client.getUrl(Uri.parse(url)).timeout(const Duration(seconds: 3));
    request.headers.set(HttpHeaders.userAgentHeader, 'AuvoraWallet/1.0-alpha (RPC-probe)');
    final response = await request.close().timeout(const Duration(seconds: 3));
    await response.drain<void>();
    return response.statusCode >= 200 && response.statusCode < 300;
  }

  Future<bool> _jsonRpc(
    HttpClient client,
    String url,
    String method,
    List<Object?> params,
  ) async {
    final request = await client.postUrl(Uri.parse(url)).timeout(const Duration(seconds: 3));
    request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
    request.headers.set(HttpHeaders.userAgentHeader, 'AuvoraWallet/1.0-alpha (RPC-probe)');
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');
    final body = jsonEncode({
      'jsonrpc': '2.0',
      'id': 1,
      'method': method,
      'params': params,
    });
    request.add(utf8.encode(body));
    final response = await request.close().timeout(const Duration(seconds: 3));
    final text = await response.transform(utf8.decoder).join();
    if (response.statusCode < 200 || response.statusCode >= 300) return false;
    final decoded = jsonDecode(text);
    if (decoded is! Map) return false;
    if (decoded['error'] != null) return false;
    // Solana getHealth returns "ok"; eth_blockNumber returns hex result.
    return decoded.containsKey('result');
  }
}
