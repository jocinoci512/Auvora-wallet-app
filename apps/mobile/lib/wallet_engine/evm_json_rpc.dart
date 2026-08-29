import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import '../release/network_env.dart';
import 'models.dart';
import 'rpc_endpoints.dart';

/// Thrown when an RPC/provider call fails — never treat as a confirmed zero balance.
class RpcBalanceException implements Exception {
  RpcBalanceException(this.message, {this.chainId, this.endpoint});

  final String message;
  final int? chainId;
  final String? endpoint;

  @override
  String toString() => 'RpcBalanceException: $message';
}

/// Pure helpers for Wei ↔ ETH (and other 18-decimal EVM natives).
abstract final class EvmAmountCodec {
  static BigInt parseHexQuantity(String hex) {
    var h = hex.trim().toLowerCase();
    if (h.startsWith('0x')) h = h.substring(2);
    if (h.isEmpty) return BigInt.zero;
    return BigInt.parse(h, radix: 16);
  }

  /// Converts integer wei to ETH decimal (18 decimals).
  static double weiToEth(BigInt wei) {
    final whole = wei ~/ BigInt.from(10).pow(18);
    final frac = wei % BigInt.from(10).pow(18);
    final fracStr = frac.toString().padLeft(18, '0');
    return double.parse('$whole.$fracStr');
  }

  static BigInt ethToWei(double eth) {
    final scaled = eth * math.pow(10, 18);
    return BigInt.from(scaled.round());
  }
}

typedef EvmJsonRpcCaller = Future<Object?> Function(
  String rpcUrl,
  String method,
  List<Object?> params,
);

/// EVM JSON-RPC client (chainId, balance, nonce, gas, optional testnet sendRaw).
///
/// Never logs full RPC URLs that may embed Alchemy path secrets.
class EvmJsonRpcClient {
  EvmJsonRpcClient({
    HttpClient? httpClient,
    EvmJsonRpcCaller? caller,
    this.timeout = const Duration(seconds: 8),
  })  : _httpClient = httpClient,
        _caller = caller;

  final HttpClient? _httpClient;
  final EvmJsonRpcCaller? _caller;
  final Duration timeout;

  /// Expected EIP-155 chain id for [chain] under the current (or given) env.
  static int expectedChainId(ChainId chain, [NetworkEnv? env]) {
    final networkEnv = env ?? AuvoraNetworkEnv.current;
    final asset = chain.assetNetwork;
    final id = NetworkCatalog.evmChainId(asset, networkEnv);
    if (id == null) {
      throw ArgumentError('Chain ${chain.key} is not an EVM network');
    }
    return id;
  }

  Future<int> ethChainId(String rpcUrl) async {
    final result = await _call(rpcUrl, 'eth_chainId', const []);
    if (result is! String) {
      throw RpcBalanceException('eth_chainId returned non-hex', endpoint: RpcEndpoints.displayLabel(rpcUrl));
    }
    return EvmAmountCodec.parseHexQuantity(result).toInt();
  }

  Future<int> ethGetTransactionCount(String rpcUrl, String address) async {
    final normalized = address.trim();
    if (!RegExp(r'^0x[a-fA-F0-9]{40}$').hasMatch(normalized)) {
      throw RpcBalanceException('Invalid EVM address for eth_getTransactionCount');
    }
    final result = await _call(rpcUrl, 'eth_getTransactionCount', [normalized, 'pending']);
    if (result is! String) {
      throw RpcBalanceException(
        'eth_getTransactionCount returned non-hex',
        endpoint: RpcEndpoints.displayLabel(rpcUrl),
      );
    }
    return EvmAmountCodec.parseHexQuantity(result).toInt();
  }

  Future<BigInt> ethGasPrice(String rpcUrl) async {
    final result = await _call(rpcUrl, 'eth_gasPrice', const []);
    if (result is! String) {
      throw RpcBalanceException(
        'eth_gasPrice returned non-hex',
        endpoint: RpcEndpoints.displayLabel(rpcUrl),
      );
    }
    return EvmAmountCodec.parseHexQuantity(result);
  }

  Future<String> ethSendRawTransaction(String rpcUrl, String signedHex) async {
    final raw = signedHex.trim();
    if (!RegExp(r'^0x[a-fA-F0-9]+$').hasMatch(raw) || raw.length < 10) {
      throw RpcBalanceException('Invalid signed transaction');
    }
    final result = await _call(rpcUrl, 'eth_sendRawTransaction', [raw]);
    if (result is! String || !result.startsWith('0x')) {
      throw RpcBalanceException(
        'eth_sendRawTransaction returned no hash',
        endpoint: RpcEndpoints.displayLabel(rpcUrl),
      );
    }
    return result;
  }

  Future<String> resolveLiveTestnetRpc({
    required ChainId chain,
    NetworkEnv? env,
    List<String>? urlsOverride,
  }) async {
    final expected = expectedChainId(chain, env);
    final urls = urlsOverride ?? RpcEndpoints.urlsFor(chain);
    Object? lastError;
    for (final url in urls) {
      try {
        if ((env ?? AuvoraNetworkEnv.current) == NetworkEnv.testnet &&
            RpcEndpoints.looksLikeMainnetUrl(url)) {
          lastError = RpcBalanceException(
            'Refusing mainnet RPC host in testnet mode',
            endpoint: RpcEndpoints.displayLabel(url),
          );
          continue;
        }
        final id = await ethChainId(url);
        if (id != expected) {
          lastError = RpcBalanceException(
            'RPC chainId $id != expected $expected',
            chainId: id,
            endpoint: RpcEndpoints.displayLabel(url),
          );
          continue;
        }
        return url;
      } catch (e) {
        lastError = e;
      }
    }
    throw RpcBalanceException(
      'Unable to reach ${chain.label} RPC (${lastError ?? 'all endpoints failed'})',
      chainId: expected,
    );
  }

  Future<BigInt> ethGetBalance(String rpcUrl, String address) async {
    final normalized = address.trim();
    if (!RegExp(r'^0x[a-fA-F0-9]{40}$').hasMatch(normalized)) {
      throw RpcBalanceException('Invalid EVM address for eth_getBalance');
    }
    final result = await _call(rpcUrl, 'eth_getBalance', [normalized, 'latest']);
    if (result is! String) {
      throw RpcBalanceException(
        'eth_getBalance returned non-hex',
        endpoint: RpcEndpoints.displayLabel(rpcUrl),
      );
    }
    return EvmAmountCodec.parseHexQuantity(result);
  }

  /// Failover across [RpcEndpoints.urlsFor] for [chain].
  ///
  /// Verifies `eth_chainId` matches the expected network env before trusting balance.
  Future<({BigInt wei, int chainId, String endpointLabel})> getNativeBalanceWei({
    required ChainId chain,
    required String address,
    NetworkEnv? env,
    List<String>? urlsOverride,
  }) async {
    final expected = expectedChainId(chain, env);
    final urls = urlsOverride ?? RpcEndpoints.urlsFor(chain);
    if (urls.isEmpty) {
      throw RpcBalanceException('No RPC endpoints configured for ${chain.key}', chainId: expected);
    }

    Object? lastError;
    for (final url in urls) {
      try {
        final id = await ethChainId(url);
        if (id != expected) {
          lastError = RpcBalanceException(
            'RPC chainId $id != expected $expected',
            chainId: id,
            endpoint: RpcEndpoints.displayLabel(url),
          );
          continue;
        }
        // Fail closed: never accept a mainnet host while in TESTNET mode.
        if ((env ?? AuvoraNetworkEnv.current) == NetworkEnv.testnet &&
            RpcEndpoints.looksLikeMainnetUrl(url)) {
          lastError = RpcBalanceException(
            'Refusing mainnet RPC host in testnet mode',
            chainId: id,
            endpoint: RpcEndpoints.displayLabel(url),
          );
          continue;
        }
        final wei = await ethGetBalance(url, address);
        return (
          wei: wei,
          chainId: id,
          endpointLabel: RpcEndpoints.displayLabel(url),
        );
      } catch (e) {
        lastError = e;
      }
    }
    throw RpcBalanceException(
      'Unable to refresh ${chain.label} balance (${lastError ?? 'all endpoints failed'})',
      chainId: expected,
    );
  }

  Future<Object?> _call(String rpcUrl, String method, List<Object?> params) async {
    final override = _caller;
    if (override != null) return override(rpcUrl, method, params);

    final client = _httpClient ?? (HttpClient()..connectionTimeout = timeout);
    final owned = _httpClient == null;
    try {
      final request = await client.postUrl(Uri.parse(rpcUrl)).timeout(timeout);
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.userAgentHeader, 'AuvoraWallet/1.0-alpha (balance)');
      request.add(
        utf8.encode(
          jsonEncode({
            'jsonrpc': '2.0',
            'id': 1,
            'method': method,
            'params': params,
          }),
        ),
      );
      final response = await request.close().timeout(timeout);
      final text = await response.transform(utf8.decoder).join();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw RpcBalanceException(
          'HTTP ${response.statusCode}',
          endpoint: RpcEndpoints.displayLabel(rpcUrl),
        );
      }
      final decoded = jsonDecode(text);
      if (decoded is! Map) {
        throw RpcBalanceException('Invalid JSON-RPC body', endpoint: RpcEndpoints.displayLabel(rpcUrl));
      }
      if (decoded['error'] != null) {
        throw RpcBalanceException(
          'JSON-RPC error',
          endpoint: RpcEndpoints.displayLabel(rpcUrl),
        );
      }
      return decoded['result'];
    } finally {
      if (owned) client.close(force: true);
    }
  }
}
