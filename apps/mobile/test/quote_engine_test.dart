import 'package:auvora_wallet/engine/models.dart';
import 'package:auvora_wallet/engine/quote_engine.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final engine = QuoteEngine(providerCode: 'test-sim');

  test('buy quote lists fees and expires', () async {
    final q = await engine.quoteBuy(
      asset: 'ETH',
      network: AssetNetwork.ethereum,
      fiatUsd: 100,
      method: PaymentMethod.card,
      assetPriceUsd: 3420,
    );
    expect(q.op, EngineOp.buy);
    expect(q.toAsset, 'ETH');
    expect(q.fees.length, greaterThanOrEqualTo(2));
    expect(q.totalFeesUsd, greaterThan(0));
    expect(q.secondsRemaining, greaterThan(0));
    expect(q.isExpired, isFalse);
    expect(q.provider, 'test-sim');
  });

  test('sell quote computes payout after fees', () async {
    final q = await engine.quoteSell(
      asset: 'ETH',
      network: AssetNetwork.ethereum,
      cryptoAmount: 1,
      assetPriceUsd: 1000,
    );
    expect(q.toAsset, 'USD');
    expect(q.toAmount, lessThan(1000));
    expect(q.arrivalLabel.toLowerCase(), contains('hour'));
  });

  test('swap rejects identical assets', () async {
    expect(
      () => engine.quoteSwap(
        fromAsset: 'ETH',
        toAsset: 'ETH',
        network: AssetNetwork.ethereum,
        fromAmount: 1,
        fromPrice: 100,
        toPrice: 100,
      ),
      throwsA(isA<QuoteException>()),
    );
  });

  test('swap includes slippage min received and rate', () async {
    final q = await engine.quoteSwap(
      fromAsset: 'ETH',
      toAsset: 'USDC',
      network: AssetNetwork.ethereum,
      fromAmount: 1,
      fromPrice: 3000,
      toPrice: 1,
      slippageBps: 50,
    );
    expect(q.minReceived, lessThan(q.toAmount));
    expect(q.slippageBps, 50);
    expect(q.rate, greaterThan(0));
  });

  test('bridge rejects same network', () async {
    expect(
      () => engine.quoteBridge(
        asset: 'USDC',
        fromNetwork: AssetNetwork.ethereum,
        toNetwork: AssetNetwork.ethereum,
        amount: 50,
        priceUsd: 1,
      ),
      throwsA(isA<QuoteException>()),
    );
  });

  test('bridge shows destination network', () async {
    final q = await engine.quoteBridge(
      asset: 'USDC',
      fromNetwork: AssetNetwork.ethereum,
      toNetwork: AssetNetwork.polygon,
      amount: 50,
      priceUsd: 1,
    );
    expect(q.destNetwork, AssetNetwork.polygon);
    expect(q.fees.any((f) => f.label.toLowerCase().contains('bridge')), isTrue);
  });

  test('stake enforces minimum', () async {
    final pool = QuoteEngine.stakePools.first;
    expect(
      () => engine.quoteStake(pool: pool, amount: pool.minStake / 10, priceUsd: 3000),
      throwsA(isA<QuoteException>()),
    );
  });

  test('stake quote surfaces APY and lock', () async {
    final pool = QuoteEngine.stakePools.first;
    final q = await engine.quoteStake(pool: pool, amount: pool.minStake, priceUsd: 3000);
    expect(q.apyPct, pool.apyPct);
    expect(q.validatorName, pool.validatorName);
    expect(q.lockDays, pool.lockDays);
  });

  test('humanizeEngineError maps expired quotes', () {
    expect(
      humanizeEngineError(QuoteException('This quote expired.')),
      contains('expired'),
    );
  });
}
