import 'package:flutter/foundation.dart';

import '../portfolio/models.dart';

enum EngineOp { buy, sell, swap, bridge, stake }

enum EngineStatus {
  preparing,
  waitingConfirmation,
  processing,
  completed,
  failed,
  cancelled,
}

enum PaymentMethod { card, bank, applePay, googlePay, balance }

@immutable
class FeeLine {
  const FeeLine({
    required this.label,
    required this.amount,
    required this.asset,
    required this.fiatUsd,
  });

  final String label;
  final double amount;
  final String asset;
  final double fiatUsd;
}

@immutable
class AssetQuote {
  const AssetQuote({
    required this.id,
    required this.op,
    required this.provider,
    required this.fromAsset,
    required this.toAsset,
    required this.fromAmount,
    required this.toAmount,
    required this.minReceived,
    required this.rate,
    required this.fees,
    required this.expiresAt,
    required this.estimatedSeconds,
    required this.sourceNetwork,
    this.destNetwork,
    this.slippageBps = 50,
    this.apyPct,
    this.validatorName,
    this.lockDays,
    this.routeSummary,
  });

  final String id;
  final EngineOp op;
  final String provider;
  final String fromAsset;
  final String toAsset;
  final double fromAmount;
  final double toAmount;
  final double minReceived;
  final double rate;
  final List<FeeLine> fees;
  final DateTime expiresAt;
  final int estimatedSeconds;
  final AssetNetwork sourceNetwork;
  final AssetNetwork? destNetwork;
  final int slippageBps;
  final double? apyPct;
  final String? validatorName;
  final int? lockDays;
  final String? routeSummary;

  double get totalFeesUsd => fees.fold(0, (s, f) => s + f.fiatUsd);

  bool get isPreview => provider == 'auvora-sim' || provider.endsWith('-sim');

  /// Human label — never show raw adapter codes in the UI.
  String get providerLabel {
    if (isPreview) return 'Auvora preview';
    switch (provider) {
      case 'moonpay':
        return 'MoonPay';
      case 'ramp':
        return 'Ramp';
      case 'transak':
        return 'Transak';
      case 'sardine':
        return 'Sardine';
      default:
        return provider;
    }
  }

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  int get secondsRemaining {
    final s = expiresAt.difference(DateTime.now()).inSeconds;
    return s < 0 ? 0 : s;
  }

  String get arrivalLabel {
    if (estimatedSeconds < 60) return 'Usually under a minute';
    if (estimatedSeconds < 3600) return 'About ${(estimatedSeconds / 60).ceil()} minutes';
    return 'About ${(estimatedSeconds / 3600).ceil()} hours';
  }
}

@immutable
class StakePool {
  const StakePool({
    required this.id,
    required this.asset,
    required this.network,
    required this.validatorName,
    required this.apyPct,
    required this.lockDays,
    required this.minStake,
    this.commissionPct = 5,
  });

  final String id;
  final String asset;
  final AssetNetwork network;
  final String validatorName;
  final double apyPct;
  final int lockDays;
  final double minStake;
  final double commissionPct;
}

@immutable
class EngineReceipt {
  const EngineReceipt({
    required this.id,
    required this.op,
    required this.status,
    required this.fromAsset,
    required this.toAsset,
    required this.fromAmount,
    required this.toAmount,
    required this.fees,
    required this.networkLabel,
    required this.createdAt,
    required this.reference,
    this.provider,
    this.note,
    this.isPreview = true,
  });

  final String id;
  final EngineOp op;
  final EngineStatus status;
  final String fromAsset;
  final String toAsset;
  final double fromAmount;
  final double toAmount;
  final List<FeeLine> fees;
  final String networkLabel;
  final DateTime createdAt;
  final String reference;
  final String? provider;
  final String? note;
  final bool isPreview;

  String get providerLabel {
    if (isPreview || provider == null || provider == 'auvora-sim') return 'Auvora preview';
    return provider!;
  }
}

extension EngineOpLabel on EngineOp {
  String get label {
    switch (this) {
      case EngineOp.buy:
        return 'Buy';
      case EngineOp.sell:
        return 'Sell';
      case EngineOp.swap:
        return 'Swap';
      case EngineOp.bridge:
        return 'Bridge';
      case EngineOp.stake:
        return 'Stake';
    }
  }

  String get verbPast {
    switch (this) {
      case EngineOp.buy:
        return 'Bought';
      case EngineOp.sell:
        return 'Sold';
      case EngineOp.swap:
        return 'Swapped';
      case EngineOp.bridge:
        return 'Bridged';
      case EngineOp.stake:
        return 'Staked';
    }
  }
}

extension EngineStatusLabel on EngineStatus {
  String get label {
    switch (this) {
      case EngineStatus.preparing:
        return 'Preparing';
      case EngineStatus.waitingConfirmation:
        return 'Waiting for confirmation';
      case EngineStatus.processing:
        return 'Processing';
      case EngineStatus.completed:
        return 'Completed';
      case EngineStatus.failed:
        return 'Failed';
      case EngineStatus.cancelled:
        return 'Cancelled';
    }
  }
}

extension PaymentMethodLabel on PaymentMethod {
  String get label {
    switch (this) {
      case PaymentMethod.card:
        return 'Debit / credit card';
      case PaymentMethod.bank:
        return 'Bank transfer';
      case PaymentMethod.applePay:
        return 'Apple Pay';
      case PaymentMethod.googlePay:
        return 'Google Pay';
      case PaymentMethod.balance:
        return 'Wallet balance';
    }
  }
}
