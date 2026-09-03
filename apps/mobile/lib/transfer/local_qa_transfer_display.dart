/// Display helpers for Local QA transfer amounts/fees (no signing).
///
/// Local Solana/EVM QA assets must never present synthetic validator units as
/// having a real USD market value on confirmation screens.
library;

import '../portfolio/models.dart';
import '../release/auvora_qa_local_evm.dart';
import '../release/auvora_qa_local_solana.dart';
import '../transfer/address_validation.dart';
import '../wallet_engine/evm_live_fee_quote.dart';

abstract final class LocalQaTransferDisplay {
  static bool isLocalSolanaAsset(AssetHolding asset) =>
      AuvoraQaLocalSolana.isActive && asset.network == AssetNetwork.solana;

  static bool isLocalEvmAsset(AssetHolding asset) =>
      AuvoraQaLocalEvm.isActive && asset.network == AssetNetwork.ethereum;

  /// Amount line for Review/Ready — Local Solana QA never appends fiat.
  static String amountLine({
    required double amount,
    required AssetHolding asset,
    required String Function(double usd) money,
    int? qaNotionalUsdCents,
  }) {
    if (isLocalSolanaAsset(asset)) {
      final n = amount > 0 ? amount : 0.0;
      return '${n.toStringAsFixed(6)} ${AuvoraQaLocalSolana.nativeAssetLabel}';
    }
    if (qaNotionalUsdCents != null) {
      return '${amount > 0 ? amount.toStringAsFixed(6) : '0.000001'} ${asset.ticker} · ${money(qaNotionalUsdCents / 100)}';
    }
    return '${amount.toStringAsFixed(6)} ${asset.ticker} · ${money(amount * asset.priceUsd)}';
  }

  /// Available balance line — suppress fiat for Local Solana QA.
  static String availableLine({
    required AssetHolding asset,
    required String cryptoBalance,
    required String Function(double usd) money,
  }) {
    if (isLocalSolanaAsset(asset)) {
      return 'Available $cryptoBalance · LOCAL QA · No monetary value';
    }
    return 'Available $cryptoBalance · ${money(asset.fiatValue)}';
  }

  /// Network fee line — Local Solana/EVM QA never appends `$…`.
  static String feeLine({
    required FeeEstimate fee,
    required String Function(double usd) money,
    AssetHolding? asset,
  }) {
    final amt = EvmLiveFeeQuote.formatNativeAmount(fee.feeCrypto);
    // QA-labeled fee assets never carry real USD — even if a stale feeUsd was set.
    if (fee.feeAsset == AuvoraQaLocalSolana.feeAssetLabel ||
        (AuvoraQaLocalSolana.isActive &&
            (asset == null || asset.network == AssetNetwork.solana))) {
      final liveTag = fee.isLive
          ? ''
          : (fee.rpcUnavailable ? ' · estimate unavailable' : '');
      return '$amt ${AuvoraQaLocalSolana.feeAssetLabel}$liveTag';
    }
    if (fee.feeAsset.contains('QA ETH') ||
        (AuvoraQaLocalEvm.isActive &&
            fee.feeAsset.contains('QA') &&
            (asset == null || asset.network == AssetNetwork.ethereum))) {
      final liveTag = fee.isLive ? '' : ' · estimate unavailable';
      return '~$amt ${fee.feeAsset}$liveTag';
    }
    if (fee.isLive && fee.feeUsd <= 0) {
      return '~$amt ${fee.feeAsset}';
    }
    return '$amt ${fee.feeAsset} · ${money(fee.feeUsd)}';
  }

  /// True when a fee/amount string must not contain USD markers under Local Solana QA.
  static bool containsFiatMarkers(String display) =>
      display.contains(r'$') ||
      RegExp(r'\bUSD\b', caseSensitive: false).hasMatch(display) ||
      display.contains('· \$');
}
