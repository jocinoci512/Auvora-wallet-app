import 'dart:convert';
import 'dart:io';

import '../release/auvora_qa_local_solana.dart';
import 'rpc_endpoints.dart';

class SolanaRpcException implements Exception {
  const SolanaRpcException(this.message);

  final String message;

  @override
  String toString() => 'SolanaRpcException: $message';
}

typedef SolanaJsonRpcCaller = Future<Object?> Function(
  String rpcUrl,
  String method,
  List<Object?> params,
);

class SolanaJsonRpcClient {
  SolanaJsonRpcClient({
    HttpClient? httpClient,
    SolanaJsonRpcCaller? caller,
    this.timeout = const Duration(seconds: 8),
  })  : _httpClient = httpClient,
        _caller = caller;

  static const int simpleTransferFallbackFeeLamports = 5000;

  final HttpClient? _httpClient;
  final SolanaJsonRpcCaller? _caller;
  final Duration timeout;

  Future<bool> getHealth(String rpcUrl) async {
    final result = await _call(rpcUrl, 'getHealth', const []);
    return result == 'ok';
  }

  Future<Map<String, dynamic>> getVersion(String rpcUrl) async {
    final result = await _call(rpcUrl, 'getVersion', const []);
    return _map(result, 'getVersion');
  }

  Future<int> getBalance(String rpcUrl, String address) async {
    final result = await _call(rpcUrl, 'getBalance', [
      address,
      const {'commitment': 'confirmed'},
    ]);
    final value = _map(result, 'getBalance')['value'];
    if (value is! num)
      throw const SolanaRpcException('getBalance returned invalid value.');
    return value.toInt();
  }

  Future<({String blockhash, int lastValidBlockHeight})> getLatestBlockhash(
    String rpcUrl,
  ) async {
    final result = await _call(rpcUrl, 'getLatestBlockhash', [
      const {'commitment': 'confirmed'},
    ]);
    final value = _map(_map(result, 'getLatestBlockhash')['value'],
        'getLatestBlockhash.value');
    final blockhash = value['blockhash'];
    final height = value['lastValidBlockHeight'];
    if (blockhash is! String || height is! num) {
      throw const SolanaRpcException(
          'getLatestBlockhash returned invalid value.');
    }
    return (blockhash: blockhash, lastValidBlockHeight: height.toInt());
  }

  Future<int> getFeeForMessage(String rpcUrl, String base64Message) async {
    try {
      final result = await _call(rpcUrl, 'getFeeForMessage', [
        base64Message,
        const {'commitment': 'confirmed'},
      ]);
      final value = _map(result, 'getFeeForMessage')['value'];
      return value is num ? value.toInt() : simpleTransferFallbackFeeLamports;
    } catch (_) {
      return simpleTransferFallbackFeeLamports;
    }
  }

  Future<String> sendTransaction(
    String rpcUrl,
    String base64Transaction, {
    bool skipPreflight = false,
  }) async {
    final result = await _call(
      rpcUrl,
      'sendTransaction',
      [
        base64Transaction,
        {
          'encoding': 'base64',
          'skipPreflight': skipPreflight,
          'preflightCommitment': 'confirmed',
        },
      ],
      broadcastPath: true,
    );
    if (result is! String || result.isEmpty) {
      throw const SolanaRpcException('sendTransaction returned no signature.');
    }
    return result;
  }

  Future<List<Map<String, dynamic>?>> getSignatureStatuses(
    String rpcUrl,
    List<String> signatures,
  ) async {
    final result = await _call(rpcUrl, 'getSignatureStatuses', [
      signatures,
      const {'searchTransactionHistory': true},
    ]);
    final values = _map(result, 'getSignatureStatuses')['value'];
    if (values is! List) {
      throw const SolanaRpcException(
          'getSignatureStatuses returned invalid value.');
    }
    return values
        .map((value) => value == null ? null : _map(value, 'signature status'))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>?> getTransaction(
    String rpcUrl,
    String signature,
  ) async {
    final result = await _call(rpcUrl, 'getTransaction', [
      signature,
      const {
        'commitment': 'confirmed',
        'encoding': 'json',
        'maxSupportedTransactionVersion': 0,
      },
    ]);
    return result == null ? null : _map(result, 'getTransaction');
  }

  Future<String> requestAirdrop(
    String rpcUrl,
    String address,
    int lamports,
  ) async {
    final result = await _call(
      rpcUrl,
      'requestAirdrop',
      [address, lamports],
      broadcastPath: true,
    );
    if (result is! String || result.isEmpty) {
      throw const SolanaRpcException('requestAirdrop returned no signature.');
    }
    return result;
  }

  Future<Object?> _call(
    String rpcUrl,
    String method,
    List<Object?> params, {
    bool broadcastPath = false,
  }) async {
    _assertSafeRpc(rpcUrl, broadcastPath: broadcastPath);
    final override = _caller;
    if (override != null) return override(rpcUrl, method, params);

    final client = _httpClient ?? (HttpClient()..connectionTimeout = timeout);
    final owned = _httpClient == null;
    try {
      final request = await client.postUrl(Uri.parse(rpcUrl)).timeout(timeout);
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers
          .set(HttpHeaders.userAgentHeader, 'AuvoraWallet/1.0-alpha (solana)');
      request.add(utf8.encode(jsonEncode({
        'jsonrpc': '2.0',
        'id': 1,
        'method': method,
        'params': params,
      })));
      final response = await request.close().timeout(timeout);
      final text = await response.transform(utf8.decoder).join();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw SolanaRpcException('HTTP ${response.statusCode}');
      }
      final decoded = jsonDecode(text);
      if (decoded is! Map)
        throw const SolanaRpcException('Invalid JSON-RPC body.');
      if (decoded['error'] != null) {
        final err = decoded['error'];
        final msg = err is Map ? (err['message']?.toString() ?? err.toString()) : err.toString();
        throw SolanaRpcException('JSON-RPC error: $msg');
      }
      return decoded['result'];
    } finally {
      if (owned) client.close(force: true);
    }
  }

  static Map<String, dynamic> _map(Object? value, String method) {
    if (value is! Map)
      throw SolanaRpcException('$method returned invalid body.');
    return Map<String, dynamic>.from(value);
  }

  static void _assertSafeRpc(String rpcUrl, {required bool broadcastPath}) {
    if ((AuvoraQaLocalSolana.isActive || broadcastPath) &&
        RpcEndpoints.looksLikeMainnetUrl(rpcUrl)) {
      throw const SolanaRpcException('Refusing Solana mainnet RPC host.');
    }
  }
}
