import 'dart:async';

import '../release/auvora_qa_local_evm.dart';
import '../portfolio/models.dart';
import 'evm_json_rpc.dart';
import 'evm_live_fee_quote.dart';
import 'evm_testnet_broadcast.dart';
import 'models.dart' show ChainId, ChainIdMeta;

/// Parsed EVM transaction receipt — never includes raw signed bytes.
class EvmTransactionReceipt {
  const EvmTransactionReceipt({
    required this.success,
    required this.blockNumber,
    required this.gasUsed,
    required this.effectiveGasPrice,
    required this.feeWei,
    required this.feeNative,
  });

  final bool success;
  final int blockNumber;
  final BigInt gasUsed;
  final BigInt effectiveGasPrice;
  final BigInt feeWei;
  final double feeNative;

  String get feeAssetLabel => EvmLiveFeeQuote.nativeAssetLabel;
}

/// Bounded receipt polling for live EVM broadcasts.
class EvmReceiptConfirmer {
  EvmReceiptConfirmer({EvmJsonRpcClient? rpc}) : _rpc = rpc ?? EvmJsonRpcClient();

  final EvmJsonRpcClient _rpc;

  static EvmTransactionReceipt? parseReceipt(Map<String, dynamic> raw) {
    final statusHex = (raw['status'] as String?)?.toLowerCase();
    final success = statusHex == null || statusHex == '0x1';
    final blockHex = raw['blockNumber'];
    final gasHex = raw['gasUsed'];
    if (blockHex is! String || gasHex is! String) return null;
    final blockNumber = EvmAmountCodec.parseHexQuantity(blockHex).toInt();
    final gasUsed = EvmAmountCodec.parseHexQuantity(gasHex);
    final priceHex = (raw['effectiveGasPrice'] ?? raw['gasPrice']) as String?;
    if (priceHex == null) return null;
    final effectiveGasPrice = EvmAmountCodec.parseHexQuantity(priceHex);
    final feeWei = gasUsed * effectiveGasPrice;
    return EvmTransactionReceipt(
      success: success,
      blockNumber: blockNumber,
      gasUsed: gasUsed,
      effectiveGasPrice: effectiveGasPrice,
      feeWei: feeWei,
      feeNative: EvmAmountCodec.weiToEth(feeWei),
    );
  }

  Future<EvmTransactionReceipt?> _fetchReceipt(String rpcUrl, String txHash) async {
    final raw = await _rpc.ethGetTransactionReceiptRaw(rpcUrl, txHash);
    if (raw == null) return null;
    return parseReceipt(raw);
  }

  static const Duration pollInterval = Duration(seconds: 2);
  static const Duration pollTimeout = Duration(seconds: 90);
  static const int maxAttempts = 45;

  /// Polls until receipt is available, timeout, or [isCancelled] returns true.
  Future<EvmTransactionReceipt?> pollUntilFinal({
    required ChainId chain,
    required String txHash,
    bool Function()? isCancelled,
  }) async {
    if (!EvmTestnetBroadcast.enabledNow) return null;
    final normalized = txHash.trim().toLowerCase();
    if (!RegExp(r'^0x[a-f0-9]{64}$').hasMatch(normalized)) return null;

    final rpcUrl = await _rpc.resolveLiveTestnetRpc(chain: chain);
    final deadline = DateTime.now().add(pollTimeout);
    var attempts = 0;

    while (DateTime.now().isBefore(deadline) && attempts < maxAttempts) {
      if (isCancelled?.call() == true) return null;
      attempts++;
      try {
        final receipt = await _fetchReceipt(rpcUrl, normalized);
        if (receipt != null) return receipt;
      } catch (_) {
        // Transient RPC — keep polling until timeout.
      }
      await Future<void>.delayed(pollInterval);
    }
    return null;
  }

  /// Single-shot receipt fetch (repair / resume on app start).
  Future<EvmTransactionReceipt?> fetchReceipt({
    required ChainId chain,
    required String txHash,
  }) async {
    if (!EvmTestnetBroadcast.enabledNow) return null;
    final normalized = txHash.trim().toLowerCase();
    if (!RegExp(r'^0x[a-f0-9]{64}$').hasMatch(normalized)) return null;
    try {
      final rpcUrl = await _rpc.resolveLiveTestnetRpc(chain: chain);
      return await _fetchReceipt(rpcUrl, normalized);
    } catch (_) {
      return null;
    }
  }

  static bool isLiveEvmTxHash(String hash) =>
      RegExp(r'^0x[a-fA-F0-9]{64}$').hasMatch(hash.trim());

  static ChainId chainForNetwork(AssetNetwork network) {
    if (network == AssetNetwork.ethereum && AuvoraQaLocalEvm.isActive) {
      return ChainId.ethereum;
    }
    return ChainIdMeta.fromAssetNetwork(network);
  }
}
