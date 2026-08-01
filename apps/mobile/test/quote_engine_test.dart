import 'package:auvora_wallet/engine/models.dart';
import 'package:auvora_wallet/engine/quote_engine.dart';
import 'package:auvora_wallet/engine/quote_provider_port.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final engine = QuoteEngine(providerCode: 'test-sim');

  test('QuoteEngine implements QuoteEnginePort', () {
    expect(engine, isA<QuoteEnginePort>());
  });

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

  test('compareBuyProviders returns ranked offers', () async {
    final offers = await engine.compareBuyProviders(
      asset: 'ETH',
      network: AssetNetwork.ethereum,
      fiatUsd: 250,
      method: PaymentMethod.card,
      assetPriceUsd: 3420,
    );
    expect(offers.length, greaterThanOrEqualTo(3));
    expect(offers.any((o) => o.code == 'auvora-sim' && o.available), isTrue);
    expect(offers.any((o) => o.code == 'moonpay' && !o.available), isTrue);
    expect(offers.any((o) => o.code == 'ramp' && !o.available), isTrue);
    expect(offers.any((o) => o.code == 'transak' && !o.available), isTrue);
    final locked = offers.where((o) => !o.available);
    expect(locked.every((o) => (o.unavailableReason ?? '').isNotEmpty), isTrue);
    expect(
      locked.any((o) => (o.unavailableReason ?? '').toLowerCase().contains('partner')),
      isTrue,
    );
    // Sorted best receive first.
    for (var i = 1; i < offers.length; i++) {
      expect(offers[i - 1].youReceive, greaterThanOrEqualTo(offers[i].youReceive));
    }
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

  test('receipt serializes round-trip', () {
    final receipt = EngineReceipt(
      id: 'r1',
      op: EngineOp.swap,
      status: EngineStatus.completed,
      fromAsset: 'ETH',
      toAsset: 'USDC',
      fromAmount: 1,
      toAmount: 3000,
      fees: const [FeeLine(label: 'Network', amount: 1.2, asset: 'USD', fiatUsd: 1.2)],
      networkLabel: 'Ethereum',
      createdAt: DateTime.parse('2026-07-30T12:00:00Z'),
      reference: '0xabc',
      provider: 'auvora-sim',
      isPreview: true,
    );
    final back = EngineReceipt.fromJson(receipt.toJson());
    expect(back.id, receipt.id);
    expect(back.op, EngineOp.swap);
    expect(back.fees.single.label, 'Network');
    expect(back.isPreview, isTrue);
  });

  test('humanizeEngineError maps expired quotes', () {
    expect(
      humanizeEngineError(QuoteException('This quote expired.')),
      contains('expired'),
    );
  });
}
