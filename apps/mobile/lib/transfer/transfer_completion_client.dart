import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../account/auvora_api_config.dart';
import '../account/auth_api_client.dart';
import '../portfolio/models.dart';
import '../release/auvora_qa_local_evm.dart';
import '../release/network_env.dart';

/// Reports a device-finalized on-chain transfer to the backend for durable
/// IN_APP + EMAIL notifications. Never sends signing material.
class TransferCompletionClient {
  TransferCompletionClient({
    http.Client? httpClient,
    String? baseUrl,
    this.timeout = const Duration(seconds: 20),
  })  : _http = httpClient ?? http.Client(),
        _baseUrl = (baseUrl ?? AuvoraApiConfig.baseUrl).trim();

  final http.Client _http;
  final String _baseUrl;
  final Duration timeout;

  bool get isConfigured => _baseUrl.isNotEmpty;

  Future<Map<String, dynamic>> reportCompletedTransfer({
    required String accessToken,
    required PortfolioTx tx,
  }) async {
    if (!isConfigured) {
      throw const AuthException(
        AuthErrorKind.notConfigured,
        'Account backend is not configured for this build.',
      );
    }
    final hash = tx.hash.trim();
    if (hash.isEmpty) {
      throw const AuthException(AuthErrorKind.unknown, 'Missing transaction hash.');
    }
    final from = (tx.from ?? '').trim();
    final to = (tx.to ?? '').trim();
    if (from.isEmpty || to.isEmpty) {
      throw const AuthException(AuthErrorKind.unknown, 'Missing public transfer addresses.');
    }
    final chainId = AuvoraQaLocalEvm.isActive && tx.network == AssetNetwork.ethereum
        ? AuvoraQaLocalEvm.chainId
        : 11155111;
    final networkLabel = NetworkCatalog.displayName(tx.network, AuvoraNetworkEnv.current);
    final body = <String, dynamic>{
      'txHash': hash,
      'chainId': chainId,
      'networkLabel': networkLabel,
      'assetCode': tx.assetTicker,
      'amount': tx.amount.toString(),
      'fromAddress': from,
      'toAddress': to,
      if (tx.fee != null) 'fee': tx.fee.toString(),
      if (tx.blockNumber != null) 'blockNumber': tx.blockNumber,
      if (tx.confirmedAt != null) 'confirmedAt': tx.confirmedAt!.toIso8601String(),
    };
    final res = await _http
        .post(
          Uri.parse(
            '${_baseUrl.replaceAll(RegExp(r'/+$'), '')}/api/v1/wallets/transfers/on-chain/complete',
          ),
          headers: {
            'authorization': 'Bearer $accessToken',
            'content-type': 'application/json',
            'accept': 'application/json',
          },
          body: jsonEncode(body),
        )
        .timeout(timeout);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      final decoded = jsonDecode(res.body);
      if (decoded is Map && decoded['data'] is Map) {
        return Map<String, dynamic>.from(decoded['data'] as Map);
      }
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
      return const {'accepted': true};
    }
    throw AuthException(
      AuthErrorKind.unknown,
      'Completion report failed (${res.statusCode})',
    );
  }
}
