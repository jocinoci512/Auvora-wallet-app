import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'bitcoin_testnet_broadcast.dart';
import 'models.dart';
import 'rpc_endpoints.dart';

class BitcoinTransactionReceipt {
  const BitcoinTransactionReceipt({
    required this.success,
    required this.confirmations,
    required this.blockHeight,
    required this.feeSatoshis,
  });

  final bool success;
  final int confirmations;
  final int blockHeight;
  final int feeSatoshis;

  double get feeBtc => feeSatoshis / 100000000;
  String get feeAssetLabel => 'tBTC';
}

class BitcoinReceiptConfirmer {
  BitcoinReceiptConfirmer({http.Client? httpClient})
      : _http = httpClient ?? http.Client();

  final http.Client _http;

  static const Duration pollInterval = Duration(seconds: 4);
  static const Duration pollTimeout = Duration(seconds: 90);
  static const int maxAttempts = 25;

  static bool isLiveBitcoinTxid(String txid) {
    if (txid.isEmpty || txid.startsWith('preview') || txid.startsWith('0xpreview')) {
      return false;
    }
    return RegExp(r'^[a-fA-F0-9]{64}$').hasMatch(txid.trim());
  }

  Future<BitcoinTransactionReceipt?> pollUntilFinal({
    required String txid,
    bool Function()? isCancelled,
  }) async {
    if (!BitcoinTestnetBroadcast.enabledNow || !isLiveBitcoinTxid(txid)) {
      return null;
    }

    final urls = RpcEndpoints.urlsFor(ChainId.bitcoin);
    final baseUrl = urls.isNotEmpty
        ? urls.first.replaceAll('/api/blocks/tip/height', '')
        : 'https://mempool.space/testnet';

    final deadline = DateTime.now().add(pollTimeout);
    var attempts = 0;

    while (DateTime.now().isBefore(deadline) && attempts < maxAttempts) {
      if (isCancelled?.call() == true) return null;
      attempts++;

      try {
        final uri = Uri.parse('$baseUrl/api/tx/$txid/status');
        final response = await _http.get(uri).timeout(const Duration(seconds: 5));
        if (response.statusCode == 200) {
          final data = jsonDecode(response.body) as Map<String, dynamic>;
          final confirmed = data['confirmed'] as bool? ?? false;
          final blockHeight = (data['block_height'] as num?)?.toInt() ?? 0;
          if (confirmed) {
            return BitcoinTransactionReceipt(
              success: true,
              confirmations: 1,
              blockHeight: blockHeight,
              feeSatoshis: 0,
            );
          }
        }
      } catch (_) {
        // Transient network error: continue polling
      }
      await Future<void>.delayed(pollInterval);
    }
    return null;
  }
}
