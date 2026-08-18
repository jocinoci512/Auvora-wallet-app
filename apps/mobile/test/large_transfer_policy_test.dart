import 'package:auvora_wallet/transfer/large_transfer_policy.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('integer cents comparison requires review at \$10,000', () {
    final now = DateTime.utc(2026, 8, 18, 12);
    // 1 ETH at $10,000.00 → 1000000 cents notional for 1e18 wei.
    final decision = LargeTransferPolicy.evaluate(
      amountSmallest: BigInt.parse('1000000000000000000'),
      assetDecimals: 18,
      usdCentsPerWholeToken: 1000000,
      priceAt: now,
      now: now,
    );
    expect(decision.status, LargeTransferStatus.reviewRequired);
    expect(decision.blocksUnauditedBroadcast, isTrue);
  });

  test('value under threshold does not require review', () {
    final now = DateTime.utc(2026, 8, 18, 12);
    final decision = LargeTransferPolicy.evaluate(
      amountSmallest: BigInt.parse('1000000000000000000'),
      assetDecimals: 18,
      usdCentsPerWholeToken: 250000, // $2,500
      priceAt: now,
      now: now,
    );
    expect(decision.status, LargeTransferStatus.belowThreshold);
  });

  test('missing or stale price fails closed', () {
    final now = DateTime.utc(2026, 8, 18, 12);
    expect(
      LargeTransferPolicy.evaluate(
        amountSmallest: BigInt.one,
        assetDecimals: 18,
        usdCentsPerWholeToken: null,
        priceAt: now,
        now: now,
      ).status,
      LargeTransferStatus.priceUnavailable,
    );
    expect(
      LargeTransferPolicy.evaluate(
        amountSmallest: BigInt.one,
        assetDecimals: 18,
        usdCentsPerWholeToken: 100,
        priceAt: now.subtract(const Duration(minutes: 10)),
        now: now,
      ).status,
      LargeTransferStatus.stalePrice,
    );
  });

  test('display amount helper uses integer cents at the threshold', () {
    final now = DateTime.utc(2026, 8, 18, 12);
    final decision = LargeTransferPolicy.evaluateDisplayAmount(
      amount: 1,
      ticker: 'ETH',
      priceUsd: 10000,
      quoteAt: now,
      now: now,
    );
    expect(decision.status, LargeTransferStatus.reviewRequired);
  });
}
