import 'package:uuid/uuid.dart';

import '../portfolio/models.dart';
import 'models.dart';
import 'quote_provider_port.dart';

/// Local quote simulator — provider-swappable surface until live rails connect.
class QuoteEngine implements QuoteEnginePort {
  QuoteEngine({this.providerCode = 'auvora-sim'});

  @override
  final String providerCode;
  static const _uuid = Uuid();

  static const defaultStakePools = [
    StakePool(
      id: 'eth-auvora-1',
      asset: 'ETH',
      network: AssetNetwork.ethereum,
      validatorName: 'Auvora Ethos',
      apyPct: 3.8,
      lockDays: 1,
      minStake: 0.01,
      commissionPct: 4,
    ),
    StakePool(
      id: 'sol-auvora-1',
      asset: 'SOL',
      network: AssetNetwork.solana,
      validatorName: 'Auvora Solara',
      apyPct: 6.4,
      lockDays: 2,
      minStake: 0.1,
      commissionPct: 5,
    ),
    StakePool(
      id: 'pol-auvora-1',
      asset: 'POL',
      network: AssetNetwork.polygon,
      validatorName: 'Auvora Polygon',
      apyPct: 4.2,
      lockDays: 1,
      minStake: 10,
      commissionPct: 5,
    ),
  ];

  /// Backward-compatible alias used across UI.
  static List<StakePool> get stakePools => defaultStakePools;

  @override
  List<StakePool> get availableStakePools => defaultStakePools;

  @override
  Future<AssetQuote> quoteBuy({
    required String asset,
    required AssetNetwork network,
    required double fiatUsd,
    required PaymentMethod method,
    required double assetPriceUsd,
    String? providerOverride,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 280));
    if (fiatUsd <= 0) throw QuoteException('Enter an amount to continue.');
    final code = providerOverride ?? providerCode;
    FiatProviderMeta? meta;
    for (final m in FiatProviderCatalog.offers) {
      if (m.code == code) {
        meta = m;
        break;
      }
    }
    final bump = meta?.feeBumpPct ?? 0;
    final providerFeePct = (method == PaymentMethod.bank ? 0.005 : 0.015) + bump;
    final providerFee = fiatUsd * providerFeePct.clamp(0.001, 0.05);
    final networkFeeUsd = network == AssetNetwork.bitcoin ? 2.5 : 1.2;
    final net = (fiatUsd - providerFee - networkFeeUsd).clamp(0.0, fiatUsd).toDouble();
    final crypto = assetPriceUsd <= 0 ? 0.0 : net / assetPriceUsd;
    return AssetQuote(
      id: 'q-${_uuid.v4().substring(0, 8)}',
      op: EngineOp.buy,
      provider: code,
      fromAsset: 'USD',
      toAsset: asset,
      fromAmount: fiatUsd,
      toAmount: crypto,
      minReceived: crypto * 0.995,
      rate: assetPriceUsd,
      fees: [
        FeeLine(label: 'Service fee', amount: providerFee, asset: 'USD', fiatUsd: providerFee),
        FeeLine(label: 'Network fee (estimated)', amount: networkFeeUsd, asset: 'USD', fiatUsd: networkFeeUsd),
      ],
      expiresAt: DateTime.now().add(const Duration(seconds: 45)),
      estimatedSeconds: method == PaymentMethod.bank ? 7200 : 180,
      sourceNetwork: network,
      routeSummary: '${method.label} → $asset · ${meta?.label ?? code}',
    );
  }

  @override
  Future<List<BuyProviderOffer>> compareBuyProviders({
    required String asset,
    required AssetNetwork network,
    required double fiatUsd,
    required PaymentMethod method,
    required double assetPriceUsd,
  }) async {
    final offers = <BuyProviderOffer>[];
    for (final meta in FiatProviderCatalog.offers) {
      // Live partners stay unavailable until rails connect — preview still comparable.
      final liveLocked = meta.code != 'auvora-sim';
      final q = await quoteBuy(
        asset: asset,
        network: network,
        fiatUsd: fiatUsd,
        method: method,
        assetPriceUsd: assetPriceUsd,
        providerOverride: meta.code,
      );
      offers.add(
        BuyProviderOffer(
          code: meta.code,
          label: meta.label,
          quote: q,
          processingLabel: meta.processingLabel,
          methodsLabel: meta.methodsLabel,
          kycRequired: meta.kycRequired,
          available: !liveLocked,
          unavailableReason: liveLocked
              ? 'Coming soon after Alpha — live on-ramp partners are not connected yet.'
              : null,
        ),
      );
    }
    offers.sort((a, b) => b.youReceive.compareTo(a.youReceive));
    return offers;
  }

  @override
  Future<AssetQuote> quoteSell({
    required String asset,
    required AssetNetwork network,
    required double cryptoAmount,
    required double assetPriceUsd,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 280));
    if (cryptoAmount <= 0) throw QuoteException('Enter an amount to continue.');
    final gross = cryptoAmount * assetPriceUsd;
    final providerFee = gross * 0.012;
    final networkFeeUsd = 1.4;
    final payout = (gross - providerFee - networkFeeUsd).clamp(0.0, gross).toDouble();
    return AssetQuote(
      id: 'q-${_uuid.v4().substring(0, 8)}',
      op: EngineOp.sell,
      provider: providerCode,
      fromAsset: asset,
      toAsset: 'USD',
      fromAmount: cryptoAmount,
      toAmount: payout,
      minReceived: payout * 0.99,
      rate: assetPriceUsd,
      fees: [
        FeeLine(label: 'Service fee', amount: providerFee, asset: 'USD', fiatUsd: providerFee),
        FeeLine(label: 'Network fee (estimated)', amount: networkFeeUsd, asset: 'USD', fiatUsd: networkFeeUsd),
      ],
      expiresAt: DateTime.now().add(const Duration(seconds: 45)),
      estimatedSeconds: 3600,
      sourceNetwork: network,
      routeSummary: '$asset → bank payout',
    );
  }

  @override
  Future<AssetQuote> quoteSwap({
    required String fromAsset,
    required String toAsset,
    required AssetNetwork network,
    required double fromAmount,
    required double fromPrice,
    required double toPrice,
    int slippageBps = 50,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 320));
    if (fromAmount <= 0) throw QuoteException('Enter an amount to continue.');
    if (fromAsset == toAsset) throw QuoteException('Choose two different assets to swap.');
    final grossUsd = fromAmount * fromPrice;
    final networkFeeUsd = 1.8;
    final priceImpact = grossUsd * 0.0012;
    final outUsd = (grossUsd - networkFeeUsd - priceImpact).clamp(0.0, grossUsd).toDouble();
    final out = toPrice <= 0 ? 0.0 : outUsd / toPrice;
    final min = out * (1 - slippageBps / 10000);
    final rate = fromPrice <= 0 ? 0.0 : toPrice / fromPrice;
    return AssetQuote(
      id: 'q-${_uuid.v4().substring(0, 8)}',
      op: EngineOp.swap,
      provider: providerCode,
      fromAsset: fromAsset,
      toAsset: toAsset,
      fromAmount: fromAmount,
      toAmount: out,
      minReceived: min,
      rate: rate == 0 ? 0 : 1 / rate,
      fees: [
        FeeLine(
          label: 'Network fee (estimated)',
          amount: network == AssetNetwork.ethereum ? 0.0014 : 0.00005,
          asset: network == AssetNetwork.solana ? 'SOL' : 'ETH',
          fiatUsd: networkFeeUsd,
        ),
        FeeLine(label: 'Price impact (estimated)', amount: priceImpact, asset: 'USD', fiatUsd: priceImpact),
      ],
      expiresAt: DateTime.now().add(const Duration(seconds: 20)),
      estimatedSeconds: 45,
      sourceNetwork: network,
      slippageBps: slippageBps,
      routeSummary: '$fromAsset → $toAsset',
    );
  }

  @override
  Future<AssetQuote> quoteBridge({
    required String asset,
    required AssetNetwork fromNetwork,
    required AssetNetwork toNetwork,
    required double amount,
    required double priceUsd,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 340));
    if (amount <= 0) throw QuoteException('Enter an amount to continue.');
    if (fromNetwork == toNetwork) {
      throw QuoteException('Choose a different destination network to bridge.');
    }
    final bridgeFeeUsd = 2.8;
    final networkFeeUsd = 1.6;
    final out = amount * (1 - (bridgeFeeUsd + networkFeeUsd) / (amount * priceUsd + 0.0001));
    final received = out.clamp(0.0, amount).toDouble();
    return AssetQuote(
      id: 'q-${_uuid.v4().substring(0, 8)}',
      op: EngineOp.bridge,
      provider: providerCode,
      fromAsset: asset,
      toAsset: asset,
      fromAmount: amount,
      toAmount: received,
      minReceived: received * 0.995,
      rate: 1,
      fees: [
        FeeLine(label: 'Bridge fee', amount: bridgeFeeUsd, asset: 'USD', fiatUsd: bridgeFeeUsd),
        FeeLine(label: 'Network fee (estimated)', amount: networkFeeUsd, asset: 'USD', fiatUsd: networkFeeUsd),
      ],
      expiresAt: DateTime.now().add(const Duration(seconds: 40)),
      estimatedSeconds: fromNetwork == AssetNetwork.bitcoin || toNetwork == AssetNetwork.bitcoin ? 2400 : 600,
      sourceNetwork: fromNetwork,
      destNetwork: toNetwork,
      routeSummary: '${fromNetwork.label} → ${toNetwork.label}',
    );
  }

  @override
  Future<AssetQuote> quoteStake({
    required StakePool pool,
    required double amount,
    required double priceUsd,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 260));
    if (amount < pool.minStake) {
      throw QuoteException('Minimum stake is ${pool.minStake} ${pool.asset}.');
    }
    final networkFeeUsd = 1.1;
    return AssetQuote(
      id: 'q-${_uuid.v4().substring(0, 8)}',
      op: EngineOp.stake,
      provider: providerCode,
      fromAsset: pool.asset,
      toAsset: 'st${pool.asset}',
      fromAmount: amount,
      toAmount: amount,
      minReceived: amount,
      rate: 1,
      fees: [
        FeeLine(label: 'Network fee (estimated)', amount: networkFeeUsd, asset: 'USD', fiatUsd: networkFeeUsd),
        FeeLine(
          label: 'Validator share of rewards',
          amount: pool.commissionPct,
          asset: '%',
          fiatUsd: amount * priceUsd * (pool.commissionPct / 100) / 12,
        ),
      ],
      expiresAt: DateTime.now().add(const Duration(seconds: 60)),
      estimatedSeconds: 120,
      sourceNetwork: pool.network,
      apyPct: pool.apyPct,
      validatorName: pool.validatorName,
      lockDays: pool.lockDays,
      routeSummary: 'Stake with ${pool.validatorName}',
    );
  }
}

class QuoteException implements Exception {
  QuoteException(this.message);
  final String message;
  @override
  String toString() => message;
}

String humanizeEngineError(Object error) {
  final raw = error.toString();
  if (raw.contains('Expired') || raw.contains('expired')) {
    return 'This quote expired. Refresh for an updated price.';
  }
  if (raw.contains('balance') || raw.contains('enough')) {
    return 'There isn’t enough balance for this amount. Lower the amount or choose another asset.';
  }
  if (raw.contains('liquidity') || raw.contains('Liquidity')) {
    return 'There isn’t enough liquidity right now. Try a smaller amount or another pair.';
  }
  if (raw.contains('offline') || raw.contains('Offline')) {
    return 'You’re offline. Reconnect, then try again.';
  }
  if (raw.contains('progress') || raw.contains('already')) {
    return 'This request is already in progress. Wait a moment before trying again.';
  }
  if (raw.contains('provider') || raw.contains('Provider') || raw.contains('unavailable')) {
    return 'The payment partner is temporarily unavailable. Try again in a moment.';
  }
  if (raw.contains('congest')) {
    return 'The network is busy. Fees or arrival times may be higher than usual.';
  }
  if (raw.contains('bridge') && (raw.contains('timeout') || raw.contains('Timeout'))) {
    return 'The bridge is taking longer than expected. Keep this receipt — funds can usually be claimed or refunded.';
  }
  if (raw.contains('price') || raw.contains('moved') || raw.contains('slippage')) {
    return 'The price moved. Refresh the quote and review the new numbers before continuing.';
  }
  if (error is QuoteException) return error.message;
  return 'Something went wrong. Nothing was submitted — you can safely try again.';
}
