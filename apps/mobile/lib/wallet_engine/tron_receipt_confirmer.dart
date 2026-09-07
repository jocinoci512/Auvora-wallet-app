import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';
import 'rpc_endpoints.dart';
import 'tron_testnet_broadcast.dart';

class TronTransactionReceipt {
  const TronTransactionReceipt({
    required this.success,
    required this.blockNumber,
    required this.feeSun,
    required this.energyUsage,
    required this.netUsage,
  });

  final bool success;
  final int blockNumber;
  final int feeSun;
  final int energyUsage;
  final int netUsage;

  double get feeTrx => feeSun / 1000000;
  String get feeAssetLabel => 'TRX';
}

class TronReceiptConfirmer {
  TronReceiptConfirmer({http.Client? httpClient})
      : _http = httpClient ?? http.Client();

  final http.Client _http;

  static const Duration pollInterval = Duration(seconds: 3);
  static const Duration pollTimeout = Duration(seconds: 90);
  static const int maxAttempts = 30;

  static bool isLiveTronTxid(String txid) {
    if (txid.isEmpty || txid.startsWith('preview') || txid.startsWith('0xpreview')) {
      return false;
    }
    return RegExp(r'^[a-fA-F0-9]{64}$').hasMatch(txid.trim());
  }

  Future<TronTransactionReceipt?> pollUntilFinal({
    required String txid,
    bool Function()? isCancelled,
  }) async {
    if (!TronTestnetBroadcast.enabledNow || !isLiveTronTxid(txid)) {
      return null;
    }

    final urls = RpcEndpoints.urlsFor(ChainId.tron);
    final baseUrl = urls.isNotEmpty ? urls.first : 'https://nile.trongrid.io';

    final deadline = DateTime.now().add(pollTimeout);
    var attempts = 0;

    while (DateTime.now().isBefore(deadline) && attempts < maxAttempts) {
      if (isCancelled?.call() == true) return null;
      attempts++;

      try {
        final uri = Uri.parse('$baseUrl/wallet/gettransactioninfobyid');
        final response = await _http.post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'value': txid}),
        ).timeout(const Duration(seconds: 5));

        if (response.statusCode == 200) {
          final data = jsonDecode(response.body) as Map<String, dynamic>;
          final blockNumber = (data['blockNumber'] as num?)?.toInt() ?? 0;
          if (blockNumber > 0) {
            final receipt = data['receipt'] as Map<String, dynamic>? ?? {};
            final result = receipt['result'] as String?;
            final success = result == null || result == 'SUCCESS';
            final fee = (data['fee'] as num?)?.toInt() ?? 0;
            final energy = (receipt['energy_usage_total'] as num?)?.toInt() ?? 0;
            final net = (receipt['net_usage'] as num?)?.toInt() ?? 0;

            return TronTransactionReceipt(
              success: success,
              blockNumber: blockNumber,
              feeSun: fee,
              energyUsage: energy,
              netUsage: net,
            );
          }
        }
      } catch (_) {
        // Transient network error
      }
      await Future<void>.delayed(pollInterval);
    }
    return null;
  }
}
