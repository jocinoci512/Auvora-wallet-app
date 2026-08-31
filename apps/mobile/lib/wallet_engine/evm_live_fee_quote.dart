import '../release/auvora_qa_local_evm.dart';
import 'evm_json_rpc.dart';

/// Canonical live EVM fee quote used by Send UI and the local signer.
///
/// Fee = [gasLimit] × [gasPriceWei]. Never invents a static 0.0012 ETH path
/// when a live quote succeeded.
class EvmLiveFeeQuote {
  const EvmLiveFeeQuote({
    required this.gasPriceWei,
    required this.gasLimit,
    required this.feeWei,
    required this.feeNative,
    required this.feeAssetLabel,
    required this.isLive,
    this.rpcUnavailable = false,
  });

  final BigInt gasPriceWei;
  final int gasLimit;
  final BigInt feeWei;
  final double feeNative;
  final String feeAssetLabel;
  final bool isLive;
  final bool rpcUnavailable;

  static const int nativeTransferGasLimit = 21000;

  static String get nativeAssetLabel =>
      AuvoraQaLocalEvm.isActive ? 'QA ETH' : 'ETH';

  /// Pure constructor from live gas parameters (no RPC).
  factory EvmLiveFeeQuote.fromGasPrice({
    required BigInt gasPriceWei,
    int gasLimit = nativeTransferGasLimit,
    bool isLive = true,
  }) {
    final feeWei = gasPriceWei * BigInt.from(gasLimit);
    return EvmLiveFeeQuote(
      gasPriceWei: gasPriceWei,
      gasLimit: gasLimit,
      feeWei: feeWei,
      feeNative: EvmAmountCodec.weiToEth(feeWei),
      feeAssetLabel: nativeAssetLabel,
      isLive: isLive,
    );
  }

  /// Format for customer confirmation — enough precision for ~0.000021 QA ETH.
  static String formatNativeAmount(double fee) {
    if (fee <= 0) return '0';
    var s = fee.toStringAsFixed(12);
    if (s.contains('.')) {
      s = s.replaceFirst(RegExp(r'0+$'), '');
      if (s.endsWith('.')) s = s.substring(0, s.length - 1);
    }
    return s;
  }

  String get displayFeeLine {
    final amt = formatNativeAmount(feeNative);
    if (AuvoraQaLocalEvm.isActive) {
      return '~$amt $feeAssetLabel';
    }
    return '$amt $feeAssetLabel';
  }

  /// Applies Economy / Standard / Faster multipliers to a base gas price.
  static BigInt applySpeedMultiplier(BigInt gasPriceWei, int speedFactorPercent) {
    if (speedFactorPercent == 100) return gasPriceWei;
    return (gasPriceWei * BigInt.from(speedFactorPercent)) ~/ BigInt.from(100);
  }
}
