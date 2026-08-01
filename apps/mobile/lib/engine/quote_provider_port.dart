import 'package:flutter/foundation.dart';

import '../portfolio/models.dart';
import 'models.dart';

/// Provider-swappable quote surface — UI talks to this port, not a concrete vendor.
abstract class QuoteEnginePort {
  String get providerCode;

  List<StakePool> get availableStakePools;

  Future<AssetQuote> quoteBuy({
    required String asset,
    required AssetNetwork network,
    required double fiatUsd,
    required PaymentMethod method,
    required double assetPriceUsd,
    String? providerOverride,
  });

  Future<AssetQuote> quoteSell({
    required String asset,
    required AssetNetwork network,
    required double cryptoAmount,
    required double assetPriceUsd,
  });

  Future<AssetQuote> quoteSwap({
    required String fromAsset,
    required String toAsset,
    required AssetNetwork network,
    required double fromAmount,
    required double fromPrice,
    required double toPrice,
    int slippageBps = 50,
  });

  Future<AssetQuote> quoteBridge({
    required String asset,
    required AssetNetwork fromNetwork,
    required AssetNetwork toNetwork,
    required double amount,
    required double priceUsd,
  });

  Future<AssetQuote> quoteStake({
    required StakePool pool,
    required double amount,
    required double priceUsd,
  });

  /// Side-by-side buy offers so the UI can compare partners without knowing adapters.
  Future<List<BuyProviderOffer>> compareBuyProviders({
    required String asset,
    required AssetNetwork network,
    required double fiatUsd,
    required PaymentMethod method,
    required double assetPriceUsd,
  });
}

@immutable
class BuyProviderOffer {
  const BuyProviderOffer({
    required this.code,
    required this.label,
    required this.quote,
    required this.processingLabel,
    required this.methodsLabel,
    this.kycRequired = true,
    this.available = true,
    this.unavailableReason,
    this.externalCheckout = false,
  });

  final String code;
  final String label;
  final AssetQuote quote;
  final String processingLabel;
  final String methodsLabel;
  final bool kycRequired;
  final bool available;
  final String? unavailableReason;

  /// True when ops enabled partner hosted widget via dart-define.
  final bool externalCheckout;

  double get youReceive => quote.toAmount;
  double get totalFeesUsd => quote.totalFeesUsd;
}

/// Catalog of fiat on-ramp partners — swap implementations without changing UI.
class FiatProviderCatalog {
  static const offers = <FiatProviderMeta>[
    FiatProviderMeta(
      code: 'auvora-sim',
      label: 'Auvora preview',
      methodsLabel: 'Card · Bank · Wallet balance',
      processingLabel: 'Instant preview',
      feeBumpPct: 0,
      kycRequired: false,
    ),
    FiatProviderMeta(
      code: 'moonpay',
      label: 'MoonPay',
      methodsLabel: 'Card · Apple Pay',
      processingLabel: 'Usually a few minutes',
      feeBumpPct: 0.002,
      kycRequired: true,
    ),
    FiatProviderMeta(
      code: 'ramp',
      label: 'Ramp',
      methodsLabel: 'Card · Bank',
      processingLabel: 'Usually under 10 minutes',
      feeBumpPct: -0.001,
      kycRequired: true,
    ),
    FiatProviderMeta(
      code: 'transak',
      label: 'Transak',
      methodsLabel: 'Card · Bank',
      processingLabel: 'Usually 5–15 minutes',
      feeBumpPct: 0.004,
      kycRequired: true,
    ),
  ];
}

@immutable
class FiatProviderMeta {
  const FiatProviderMeta({
    required this.code,
    required this.label,
    required this.methodsLabel,
    required this.processingLabel,
    required this.feeBumpPct,
    required this.kycRequired,
  });

  final String code;
  final String label;
  final String methodsLabel;
  final String processingLabel;
  final double feeBumpPct;
  final bool kycRequired;
}
