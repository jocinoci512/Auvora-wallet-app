import 'package:auvora_wallet/wallet_engine/evm_live_fee_quote.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('21000 × 1000000007 displays approximately 0.000021 QA ETH', () {
    final quote = EvmLiveFeeQuote.fromGasPrice(
      gasPriceWei: BigInt.from(1000000007),
      gasLimit: 21000,
    );
    expect(quote.feeWei, BigInt.from(21000000147000));
    expect(quote.feeNative, closeTo(0.000021000000147, 1e-15));
    // Display trims trailing noise; still ≈ 0.000021, never legacy 0.0012.
    expect(EvmLiveFeeQuote.formatNativeAmount(quote.feeNative), '0.000021');
    expect(quote.displayFeeLine, contains('0.000021'));
    expect(quote.feeNative, isNot(closeTo(0.0012, 1e-6)));
  });

  test('formatNativeAmount trims trailing zeros', () {
    expect(EvmLiveFeeQuote.formatNativeAmount(0.000021), '0.000021');
    expect(EvmLiveFeeQuote.formatNativeAmount(0), '0');
  });

  test('speed multiplier scales gas price for Economy/Faster', () {
    final base = BigInt.from(1000000000);
    expect(EvmLiveFeeQuote.applySpeedMultiplier(base, 100), base);
    expect(EvmLiveFeeQuote.applySpeedMultiplier(base, 70), BigInt.from(700000000));
    expect(EvmLiveFeeQuote.applySpeedMultiplier(base, 155), BigInt.from(1550000000));
  });

  test('live quote feeWei equals gasLimit × gasPrice', () {
    final gp = BigInt.from(1587713545);
    final q = EvmLiveFeeQuote.fromGasPrice(gasPriceWei: gp, gasLimit: 21000);
    expect(q.feeWei, gp * BigInt.from(21000));
    expect(q.isLive, isTrue);
    expect(q.gasLimit, 21000);
  });
}
