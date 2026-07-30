import 'package:flutter/foundation.dart';

enum TxType {
  send,
  receive,
  swap,
  buy,
  sell,
  bridge,
  stake,
  unstake;

  String get label {
    switch (this) {
      case TxType.send:
        return 'Sent';
      case TxType.receive:
        return 'Received';
      case TxType.swap:
        return 'Swapped';
      case TxType.buy:
        return 'Bought';
      case TxType.sell:
        return 'Sold';
      case TxType.bridge:
        return 'Bridged';
      case TxType.stake:
        return 'Staked';
      case TxType.unstake:
        return 'Unstaked';
    }
  }
}

enum TxStatus {
  pending,
  completed,
  failed,
  cancelled;

  String get label {
    switch (this) {
      case TxStatus.pending:
        return 'Pending';
      case TxStatus.completed:
        return 'Completed';
      case TxStatus.failed:
        return 'Failed';
      case TxStatus.cancelled:
        return 'Cancelled';
    }
  }
}

enum AssetNetwork {
  ethereum,
  bitcoin,
  solana,
  bnbSmartChain,
  tron,
  polygon;

  String get label {
    switch (this) {
      case AssetNetwork.ethereum:
        return 'Ethereum';
      case AssetNetwork.bitcoin:
        return 'Bitcoin';
      case AssetNetwork.solana:
        return 'Solana';
      case AssetNetwork.bnbSmartChain:
        return 'BNB Smart Chain';
      case AssetNetwork.tron:
        return 'Tron';
      case AssetNetwork.polygon:
        return 'Polygon';
    }
  }

  String get short {
    switch (this) {
      case AssetNetwork.ethereum:
        return 'ETH';
      case AssetNetwork.bitcoin:
        return 'BTC';
      case AssetNetwork.solana:
        return 'SOL';
      case AssetNetwork.bnbSmartChain:
        return 'BNB';
      case AssetNetwork.tron:
        return 'TRX';
      case AssetNetwork.polygon:
        return 'POL';
    }
  }
}

@immutable
class AssetHolding {
  const AssetHolding({
    required this.id,
    required this.name,
    required this.ticker,
    required this.network,
    required this.balance,
    required this.priceUsd,
    required this.change24hPct,
    required this.color,
    this.sparkline = const [],
  });

  final String id;
  final String name;
  final String ticker;
  final AssetNetwork network;
  final double balance;
  final double priceUsd;
  final double change24hPct;
  final int color;
  final List<double> sparkline;

  double get fiatValue => balance * priceUsd;

  AssetHolding copyWith({double? balance, double? priceUsd, double? change24hPct}) {
    return AssetHolding(
      id: id,
      name: name,
      ticker: ticker,
      network: network,
      balance: balance ?? this.balance,
      priceUsd: priceUsd ?? this.priceUsd,
      change24hPct: change24hPct ?? this.change24hPct,
      color: color,
      sparkline: sparkline,
    );
  }
}

@immutable
class PortfolioTx {
  const PortfolioTx({
    required this.id,
    required this.type,
    required this.status,
    required this.network,
    required this.assetTicker,
    required this.amount,
    required this.amountUsd,
    required this.timestamp,
    required this.from,
    required this.to,
    required this.hash,
    this.fee,
    this.feeAsset,
    this.note,
  });

  final String id;
  final TxType type;
  final TxStatus status;
  final AssetNetwork network;
  final String assetTicker;
  final double amount;
  final double amountUsd;
  final DateTime timestamp;
  final String from;
  final String to;
  final String hash;
  final double? fee;
  final String? feeAsset;
  final String? note;
}

@immutable
class AddressContact {
  const AddressContact({
    required this.id,
    required this.name,
    required this.address,
    required this.network,
  });

  final String id;
  final String name;
  final String address;
  final AssetNetwork network;
}

@immutable
class PortfolioSnapshot {
  const PortfolioSnapshot({
    required this.assets,
    required this.transactions,
    required this.contacts,
    required this.trend7d,
    required this.change24hUsd,
    required this.change24hPct,
    required this.updatedAt,
    required this.isPreview,
    this.offline = false,
    this.priceError = false,
    this.syncDelayed = false,
  });

  final List<AssetHolding> assets;
  final List<PortfolioTx> transactions;
  final List<AddressContact> contacts;
  final List<double> trend7d;
  final double change24hUsd;
  final double change24hPct;
  final DateTime updatedAt;
  final bool isPreview;
  final bool offline;
  final bool priceError;
  final bool syncDelayed;

  double get totalUsd => assets.fold(0, (s, a) => s + a.fiatValue);

  List<AssetHolding> get nonZero => assets.where((a) => a.balance > 0).toList();
}
