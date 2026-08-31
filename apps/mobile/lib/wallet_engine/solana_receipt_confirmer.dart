import 'dart:async';

import '../release/auvora_qa_local_solana.dart';
import 'models.dart';
import 'rpc_endpoints.dart';
import 'solana_json_rpc.dart';
import 'solana_testnet_broadcast.dart';

/// Parsed Solana confirmation — never includes raw signed bytes.
class SolanaTransactionReceipt {
  const SolanaTransactionReceipt({
    required this.success,
    required this.slot,
    required this.feeLamports,
    required this.feeNative,
  });

  final bool success;
  final int slot;
  final int feeLamports;
  final double feeNative;

  String get feeAssetLabel =>
      AuvoraQaLocalSolana.isActive ? AuvoraQaLocalSolana.feeAssetLabel : 'SOL';
}

/// Bounded signature confirmation polling for live Solana broadcasts.
class SolanaReceiptConfirmer {
  SolanaReceiptConfirmer({SolanaJsonRpcClient? rpc})
      : _rpc = rpc ?? SolanaJsonRpcClient();

  final SolanaJsonRpcClient _rpc;

  static const Duration pollInterval = Duration(seconds: 2);
  static const Duration pollTimeout = Duration(seconds: 90);
  static const int maxAttempts = 45;

  /// Polls until confirmed/finalized (or failed), timeout, or [isCancelled].
  Future<SolanaTransactionReceipt?> pollUntilFinal({
    required String signature,
    bool Function()? isCancelled,
  }) async {
    if (!SolanaTestnetBroadcast.enabledNow ||
        !isLiveSolanaSignature(signature)) {
      return null;
    }
    final urls = RpcEndpoints.urlsFor(ChainId.solana);
    if (urls.isEmpty) return null;
    final rpcUrl = urls.first;
    final deadline = DateTime.now().add(pollTimeout);
    var attempts = 0;
    while (DateTime.now().isBefore(deadline) && attempts < maxAttempts) {
      if (isCancelled?.call() == true) return null;
      attempts++;
      try {
        final statuses =
            await _rpc.getSignatureStatuses(rpcUrl, [signature]);
        final status = statuses.isEmpty ? null : statuses.first;
        if (status != null) {
          if (status['err'] != null) {
            return SolanaTransactionReceipt(
              success: false,
              slot: (status['slot'] as num?)?.toInt() ?? 0,
              feeLamports: 0,
              feeNative: 0,
            );
          }
          final confirmationStatus = status['confirmationStatus'];
          if (confirmationStatus == 'confirmed' ||
              confirmationStatus == 'finalized') {
            return await _loadReceipt(rpcUrl, signature, status);
          }
        }
      } catch (_) {
        // Transient RPC failure: continue until the bounded timeout.
      }
      await Future<void>.delayed(pollInterval);
    }
    return null;
  }

  Future<SolanaTransactionReceipt> _loadReceipt(
    String rpcUrl,
    String signature,
    Map<String, dynamic> status,
  ) async {
    var slot = (status['slot'] as num?)?.toInt() ?? 0;
    var feeLamports = SolanaJsonRpcClient.simpleTransferFallbackFeeLamports;
    try {
      final tx = await _rpc.getTransaction(rpcUrl, signature);
      if (tx != null) {
        final meta = tx['meta'];
        if (meta is Map && meta['err'] != null) {
          return SolanaTransactionReceipt(
            success: false,
            slot: (tx['slot'] as num?)?.toInt() ?? slot,
            feeLamports: 0,
            feeNative: 0,
          );
        }
        if (meta is Map && meta['fee'] is num) {
          feeLamports = (meta['fee'] as num).toInt();
        }
        if (tx['slot'] is num) {
          slot = (tx['slot'] as num).toInt();
        }
      }
    } catch (_) {
      // Status already confirmed; fee/slot enrichment is best-effort.
    }
    return SolanaTransactionReceipt(
      success: true,
      slot: slot,
      feeLamports: feeLamports,
      feeNative: feeLamports / 1000000000,
    );
  }

  static bool isLiveSolanaSignature(String value) {
    return RegExp(
      r'^[1-9A-HJ-NP-Za-km-z]{80,90}$',
    ).hasMatch(value.trim());
  }
}
