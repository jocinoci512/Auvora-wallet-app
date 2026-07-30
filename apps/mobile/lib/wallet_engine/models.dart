import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../portfolio/models.dart';

enum ChainId {
  bitcoin,
  ethereum,
  solana,
  bnbSmartChain,
  tron,
  polygon,
}

extension ChainIdMeta on ChainId {
  String get key => switch (this) {
        ChainId.bitcoin => 'bitcoin',
        ChainId.ethereum => 'ethereum',
        ChainId.solana => 'solana',
        ChainId.bnbSmartChain => 'bnb-smart-chain',
        ChainId.tron => 'tron',
        ChainId.polygon => 'polygon',
      };

  String get label => switch (this) {
        ChainId.bitcoin => 'Bitcoin',
        ChainId.ethereum => 'Ethereum',
        ChainId.solana => 'Solana',
        ChainId.bnbSmartChain => 'BNB Smart Chain',
        ChainId.tron => 'Tron',
        ChainId.polygon => 'Polygon',
      };

  String get nativeTicker => switch (this) {
        ChainId.bitcoin => 'BTC',
        ChainId.ethereum => 'ETH',
        ChainId.solana => 'SOL',
        ChainId.bnbSmartChain => 'BNB',
        ChainId.tron => 'TRX',
        ChainId.polygon => 'POL',
      };

  AssetNetwork get assetNetwork => switch (this) {
        ChainId.bitcoin => AssetNetwork.bitcoin,
        ChainId.ethereum => AssetNetwork.ethereum,
        ChainId.solana => AssetNetwork.solana,
        ChainId.bnbSmartChain => AssetNetwork.bnbSmartChain,
        ChainId.tron => AssetNetwork.tron,
        ChainId.polygon => AssetNetwork.polygon,
      };

  static ChainId fromAssetNetwork(AssetNetwork network) => switch (network) {
        AssetNetwork.bitcoin => ChainId.bitcoin,
        AssetNetwork.ethereum => ChainId.ethereum,
        AssetNetwork.solana => ChainId.solana,
        AssetNetwork.bnbSmartChain => ChainId.bnbSmartChain,
        AssetNetwork.tron => ChainId.tron,
        AssetNetwork.polygon => ChainId.polygon,
      };
}

enum WalletSyncState { idle, syncing, degraded, offline }

enum EndpointState { healthy, degraded, offline }

enum KeyMaterialState { locked, unlocked, missing }

@immutable
class WalletAddressRecord {
  const WalletAddressRecord({
    required this.chain,
    required this.address,
    required this.derivationPath,
    this.label,
  });

  final ChainId chain;
  final String address;
  final String derivationPath;
  final String? label;

  Map<String, Object?> toJson() => {
        'chain': chain.key,
        'address': address,
        'derivationPath': derivationPath,
        'label': label,
      };

  factory WalletAddressRecord.fromJson(Map<String, Object?> json) {
    final chainKey = (json['chain'] as String?) ?? 'ethereum';
    final chain = ChainId.values.firstWhere(
      (value) => value.key == chainKey,
      orElse: () => ChainId.ethereum,
    );
    return WalletAddressRecord(
      chain: chain,
      address: (json['address'] as String?) ?? '',
      derivationPath: (json['derivationPath'] as String?) ?? '',
      label: json['label'] as String?,
    );
  }
}

@immutable
class WalletAccountRecord {
  const WalletAccountRecord({
    required this.id,
    required this.name,
    required this.index,
    required this.addresses,
    this.preferredChain = ChainId.ethereum,
  });

  final String id;
  final String name;
  final int index;
  final List<WalletAddressRecord> addresses;
  final ChainId preferredChain;

  WalletAddressRecord? addressFor(ChainId chain) {
    for (final item in addresses) {
      if (item.chain == chain) return item;
    }
    return null;
  }

  String? receiveAddress(ChainId chain) => addressFor(chain)?.address;

  Map<String, Object?> toJson() => {
        'id': id,
        'name': name,
        'index': index,
        'preferredChain': preferredChain.key,
        'addresses': addresses.map((item) => item.toJson()).toList(),
      };

  factory WalletAccountRecord.fromJson(Map<String, Object?> json) {
    final preferred = ChainId.values.firstWhere(
      (value) => value.key == json['preferredChain'],
      orElse: () => ChainId.ethereum,
    );
    return WalletAccountRecord(
      id: (json['id'] as String?) ?? 'main',
      name: (json['name'] as String?) ?? 'Main account',
      index: (json['index'] as num?)?.toInt() ?? 0,
      preferredChain: preferred,
      addresses: ((json['addresses'] as List<Object?>?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map(WalletAddressRecord.fromJson)
          .toList(),
    );
  }
}

@immutable
class WalletVaultRecord {
  const WalletVaultRecord({
    required this.walletId,
    required this.accounts,
    required this.createdAt,
    required this.supportedChains,
    this.activeAccountId,
    this.backupConfirmed = false,
    this.phraseVerifiedAt,
    this.lastSecurityReviewAt,
  });

  final String walletId;
  final List<WalletAccountRecord> accounts;
  final DateTime createdAt;
  final List<ChainId> supportedChains;
  final String? activeAccountId;
  final bool backupConfirmed;
  final DateTime? phraseVerifiedAt;
  final DateTime? lastSecurityReviewAt;

  WalletAccountRecord? get activeAccount {
    final id = activeAccountId;
    if (id == null && accounts.isNotEmpty) return accounts.first;
    for (final account in accounts) {
      if (account.id == id) return account;
    }
    return accounts.isEmpty ? null : accounts.first;
  }

  String? primaryAddress({ChainId chain = ChainId.ethereum}) =>
      activeAccount?.receiveAddress(chain) ??
      (accounts.isEmpty ? null : accounts.first.receiveAddress(chain));

  Map<String, Object?> toJson() => {
        'walletId': walletId,
        'createdAt': createdAt.toIso8601String(),
        'supportedChains': supportedChains.map((item) => item.key).toList(),
        'activeAccountId': activeAccountId,
        'backupConfirmed': backupConfirmed,
        'phraseVerifiedAt': phraseVerifiedAt?.toIso8601String(),
        'lastSecurityReviewAt': lastSecurityReviewAt?.toIso8601String(),
        'accounts': accounts.map((item) => item.toJson()).toList(),
      };

  String encode() => jsonEncode(toJson());

  factory WalletVaultRecord.fromJson(Map<String, Object?> json) {
    final supported = ((json['supportedChains'] as List<Object?>?) ?? const [])
        .map((item) => ChainId.values.firstWhere(
              (value) => value.key == item,
              orElse: () => ChainId.ethereum,
            ))
        .toList();
    return WalletVaultRecord(
      walletId: (json['walletId'] as String?) ?? 'wallet',
      createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? '') ?? DateTime.now(),
      supportedChains: supported.isEmpty ? List<ChainId>.from(ChainId.values) : supported,
      activeAccountId: json['activeAccountId'] as String?,
      backupConfirmed: json['backupConfirmed'] == true,
      phraseVerifiedAt: DateTime.tryParse((json['phraseVerifiedAt'] as String?) ?? ''),
      lastSecurityReviewAt: DateTime.tryParse((json['lastSecurityReviewAt'] as String?) ?? ''),
      accounts: ((json['accounts'] as List<Object?>?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map(WalletAccountRecord.fromJson)
          .toList(),
    );
  }

  factory WalletVaultRecord.decode(String raw) {
    final decoded = jsonDecode(raw);
    if (decoded is Map<String, Object?>) return WalletVaultRecord.fromJson(decoded);
    return WalletVaultRecord(
      walletId: 'wallet',
      accounts: const [],
      createdAt: DateTime.now(),
      supportedChains: List<ChainId>.from(ChainId.values),
    );
  }
}

@immutable
class AssetDefinition {
  const AssetDefinition({
    required this.id,
    required this.symbol,
    required this.displayName,
    required this.decimals,
    required this.networks,
    this.contractAddress,
    this.iconKey,
    this.isStable = false,
  });

  final String id;
  final String symbol;
  final String displayName;
  final int decimals;
  final List<ChainId> networks;
  final String? contractAddress;
  final String? iconKey;
  final bool isStable;
}

@immutable
class PricePoint {
  const PricePoint({
    required this.symbol,
    required this.priceUsd,
    required this.change24hPct,
    required this.sparkline7d,
    required this.updatedAt,
    this.stale = false,
  });

  final String symbol;
  final double priceUsd;
  final double change24hPct;
  final List<double> sparkline7d;
  final DateTime updatedAt;
  final bool stale;

  Map<String, Object?> toJson() => {
        'symbol': symbol,
        'priceUsd': priceUsd,
        'change24hPct': change24hPct,
        'sparkline7d': sparkline7d,
        'updatedAt': updatedAt.toIso8601String(),
        'stale': stale,
      };

  factory PricePoint.fromJson(Map<String, Object?> json) {
    return PricePoint(
      symbol: (json['symbol'] as String?) ?? '',
      priceUsd: (json['priceUsd'] as num?)?.toDouble() ?? 0,
      change24hPct: (json['change24hPct'] as num?)?.toDouble() ?? 0,
      sparkline7d: ((json['sparkline7d'] as List<Object?>?) ?? const [])
          .map((item) => (item as num).toDouble())
          .toList(),
      updatedAt: DateTime.tryParse((json['updatedAt'] as String?) ?? '') ?? DateTime.now(),
      stale: json['stale'] == true,
    );
  }
}

@immutable
class EndpointHealth {
  const EndpointHealth({
    required this.chain,
    required this.endpoint,
    required this.latencyMs,
    required this.state,
    required this.lastCheckedAt,
    this.failoverCount = 0,
  });

  final ChainId chain;
  final String endpoint;
  final int latencyMs;
  final EndpointState state;
  final DateTime lastCheckedAt;
  final int failoverCount;
}

@immutable
class SyncStatusSnapshot {
  const SyncStatusSnapshot({
    required this.state,
    required this.lastUpdatedAt,
    required this.pendingTransactions,
    this.offline = false,
    this.priceStale = false,
    this.endpointIssues = false,
    this.fromCache = false,
    this.failedChains = const [],
    this.lastSyncReason,
  });

  final WalletSyncState state;
  final DateTime lastUpdatedAt;
  final int pendingTransactions;
  final bool offline;
  final bool priceStale;
  final bool endpointIssues;
  final bool fromCache;
  final List<String> failedChains;
  final String? lastSyncReason;
}

@immutable
class WalletDiagnostics {
  const WalletDiagnostics({
    required this.cacheHits,
    required this.cacheMisses,
    required this.rpcRequests,
    required this.rpcFailures,
    required this.averageLatencyMs,
    required this.lastSyncAt,
    this.retryAttempts = 0,
    this.partialChainFailures = 0,
    this.coldStartMs,
    this.lastSyncReason,
  });

  final int cacheHits;
  final int cacheMisses;
  final int rpcRequests;
  final int rpcFailures;
  final int averageLatencyMs;
  final DateTime? lastSyncAt;
  final int retryAttempts;
  final int partialChainFailures;
  final int? coldStartMs;
  final String? lastSyncReason;

  Map<String, Object?> toJson() => {
        'cacheHits': cacheHits,
        'cacheMisses': cacheMisses,
        'rpcRequests': rpcRequests,
        'rpcFailures': rpcFailures,
        'averageLatencyMs': averageLatencyMs,
        'lastSyncAt': lastSyncAt?.toIso8601String(),
        'retryAttempts': retryAttempts,
        'partialChainFailures': partialChainFailures,
        'coldStartMs': coldStartMs,
        'lastSyncReason': lastSyncReason,
      };
}

@immutable
class TransactionFeeEstimate {
  const TransactionFeeEstimate({
    required this.networkFee,
    required this.networkFeeAsset,
    required this.networkFeeUsd,
    required this.arrivalLabel,
    this.serviceFeeUsd = 0,
    this.explorerBaseUrl,
  });

  final double networkFee;
  final String networkFeeAsset;
  final double networkFeeUsd;
  final String arrivalLabel;
  final double serviceFeeUsd;
  final String? explorerBaseUrl;
}

@immutable
class TransactionDraft {
  const TransactionDraft({
    required this.chain,
    required this.fromAddress,
    required this.toAddress,
    required this.assetSymbol,
    required this.amount,
    required this.memo,
    required this.estimatedFee,
    required this.unsignedPayload,
  });

  final ChainId chain;
  final String fromAddress;
  final String toAddress;
  final String assetSymbol;
  final double amount;
  final String? memo;
  final TransactionFeeEstimate estimatedFee;
  final String unsignedPayload;
}

@immutable
class TransactionSubmissionResult {
  const TransactionSubmissionResult({
    required this.id,
    required this.hash,
    required this.status,
    required this.explorerUrl,
    required this.submittedAt,
    required this.preview,
  });

  final String id;
  final String hash;
  final TxStatus status;
  final String explorerUrl;
  final DateTime submittedAt;
  final bool preview;
}
