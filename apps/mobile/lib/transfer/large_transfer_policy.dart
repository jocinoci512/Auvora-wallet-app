/// Self-custody large-transfer review policy.
///
/// Compares notional USD value in **integer cents**. Never uses floating point
/// for the threshold check. Admin review cannot obtain keys; if live broadcast
/// is later enabled, the device still signs locally after approval.
///
/// This is an Auvora-app policy, not a blockchain freeze.
abstract final class LargeTransferPolicy {
  /// $10,000.00 — override with `--dart-define=LARGE_TRANSFER_USD_CENTS=...`
  static const int defaultThresholdUsdCents = 1000000;

  static int get thresholdUsdCents {
    const raw = String.fromEnvironment('LARGE_TRANSFER_USD_CENTS', defaultValue: '');
    if (raw.isEmpty) return defaultThresholdUsdCents;
    return int.tryParse(raw) ?? defaultThresholdUsdCents;
  }

  static const Duration maxPriceAge = Duration(minutes: 5);

  static LargeTransferDecision evaluate({
    required BigInt amountSmallest,
    required int assetDecimals,
    required int? usdCentsPerWholeToken,
    required DateTime? priceAt,
    DateTime? now,
    int? thresholdCents,
  }) {
    final limit = thresholdCents ?? thresholdUsdCents;
    if (limit <= 0) {
      return const LargeTransferDecision(status: LargeTransferStatus.belowThreshold);
    }
    if (assetDecimals < 0 || assetDecimals > 36) {
      return const LargeTransferDecision(
        status: LargeTransferStatus.priceUnavailable,
        message: 'Asset decimals are invalid. Review cannot run safely.',
      );
    }
    if (usdCentsPerWholeToken == null || usdCentsPerWholeToken <= 0) {
      return const LargeTransferDecision(
        status: LargeTransferStatus.priceUnavailable,
        message: 'A reliable USD price is unavailable. Large-transfer review cannot be skipped.',
      );
    }
    final ts = now ?? DateTime.now();
    if (priceAt == null || ts.difference(priceAt).abs() > maxPriceAge) {
      return const LargeTransferDecision(
        status: LargeTransferStatus.stalePrice,
        message: 'USD price is stale. Large-transfer review cannot be skipped.',
      );
    }
    if (amountSmallest <= BigInt.zero) {
      return const LargeTransferDecision(status: LargeTransferStatus.belowThreshold);
    }

    final scale = BigInt.from(10).pow(assetDecimals);
    final notionalCents = (amountSmallest * BigInt.from(usdCentsPerWholeToken)) ~/ scale;
    if (notionalCents >= BigInt.from(limit)) {
      return LargeTransferDecision(
        status: LargeTransferStatus.reviewRequired,
        notionalUsdCents: notionalCents.toInt(),
        message:
            'This transfer is at or above the Auvora review threshold. An administrator must approve before this device can broadcast. Keys stay on this device.',
      );
    }
    return LargeTransferDecision(
      status: LargeTransferStatus.belowThreshold,
      notionalUsdCents: notionalCents.toInt(),
    );
  }

  static int nativeDecimals(String ticker) {
    return switch (ticker.toUpperCase()) {
      'BTC' => 8,
      'SOL' => 9,
      'TRX' => 6,
      'USDC' || 'USDT' => 6,
      _ => 18,
    };
  }

  /// Converts a display amount to integer smallest units without using IEEE
  /// remainder for the threshold path. Trailing fraction beyond [decimals] is truncated.
  static BigInt amountToSmallest(double amount, int decimals) {
    if (amount <= 0) return BigInt.zero;
    final fixed = amount.toStringAsFixed(decimals);
    final parts = fixed.split('.');
    final whole = parts[0].replaceAll('-', '');
    final frac = (parts.length > 1 ? parts[1] : '').padRight(decimals, '0').substring(0, decimals);
    return BigInt.parse('$whole$frac');
  }

  static LargeTransferDecision evaluateDisplayAmount({
    required double amount,
    required String ticker,
    required double priceUsd,
    required DateTime? quoteAt,
    DateTime? now,
    int? thresholdCents,
  }) {
    final decimals = nativeDecimals(ticker);
    final usdCents = priceUsd > 0 ? (priceUsd * 100).round() : null;
    return evaluate(
      amountSmallest: amountToSmallest(amount, decimals),
      assetDecimals: decimals,
      usdCentsPerWholeToken: usdCents,
      priceAt: quoteAt,
      now: now,
      thresholdCents: thresholdCents,
    );
  }
}

enum LargeTransferStatus { belowThreshold, reviewRequired, priceUnavailable, stalePrice }

class LargeTransferDecision {
  const LargeTransferDecision({
    required this.status,
    this.notionalUsdCents,
    this.message,
  });

  final LargeTransferStatus status;
  final int? notionalUsdCents;
  final String? message;

  bool get blocksUnauditedBroadcast =>
      status == LargeTransferStatus.reviewRequired ||
      status == LargeTransferStatus.priceUnavailable ||
      status == LargeTransferStatus.stalePrice;
}
