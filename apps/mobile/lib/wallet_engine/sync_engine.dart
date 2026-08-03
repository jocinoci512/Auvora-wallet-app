import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../portfolio/models.dart';
import '../reliability/cache_store.dart';
import '../reliability/retry.dart';
import '../reliability/startup_timing.dart';
import 'asset_registry.dart';
import 'blockchain_adapter.dart';
import 'models.dart';
import 'network_manager.dart';
import 'price_service.dart';
import 'wallet_engine.dart';

class SyncEngine {
  SyncEngine({
    required WalletEngine walletEngine,
    required BlockchainLayer blockchainLayer,
    required AssetRegistry assetRegistry,
    required PriceService priceService,
    required NetworkManager networkManager,
    SharedPreferences? prefs,
    CacheStore? cacheStore,
  })  : _walletEngine = walletEngine,
        _blockchainLayer = blockchainLayer,
        _assetRegistry = assetRegistry,
        _priceService = priceService,
        _networkManager = networkManager,
        _prefs = prefs,
        _cache = cacheStore ?? CacheStore(prefs: prefs);

  final WalletEngine _walletEngine;
  final BlockchainLayer _blockchainLayer;
  final AssetRegistry _assetRegistry;
  final PriceService _priceService;
  final NetworkManager _networkManager;
  final CacheStore _cache;
  SharedPreferences? _prefs;

  WalletDiagnostics _diagnostics = const WalletDiagnostics(
    cacheHits: 0,
    cacheMisses: 0,
    rpcRequests: 0,
    rpcFailures: 0,
    averageLatencyMs: 0,
    lastSyncAt: null,
  );

  SyncStatusSnapshot _syncStatus = SyncStatusSnapshot(
    state: WalletSyncState.idle,
    lastUpdatedAt: DateTime.fromMillisecondsSinceEpoch(0),
    pendingTransactions: 0,
  );

  List<String> _failedChains = const [];
  String? _lastSyncReason;

  /// Legacy key kept for migration; new writes also go through [CacheStore].
  static const _kPortfolioCache = 'auvora_portfolio_cache_v2';

  WalletDiagnostics get diagnostics => _diagnostics;
  SyncStatusSnapshot get syncStatus => _syncStatus;
  CacheStore get cacheStore => _cache;

  void recordColdStart(Duration elapsed) {
    _diagnostics = _copyDiag(coldStartMs: elapsed.inMilliseconds);
  }

  void noteCoordinatorEvent(String reason) {
    _lastSyncReason = reason;
  }

  void recordSyncDuration(Duration elapsed) {
    _diagnostics = _copyDiag(
      lastSyncDurationMs: elapsed.inMilliseconds,
      syncSampleCount: _diagnostics.syncSampleCount + 1,
    );
  }

  void noteErrorEvent() {
    _diagnostics = _copyDiag(errorEvents: _diagnostics.errorEvents + 1);
  }

  Future<void> warmHelpCache() async {
    await _cache.write(
      ns: CacheStore.nsHelp,
      id: 'faq-bundle',
      payload: {
        'version': 1,
        'warmedAt': DateTime.now().toIso8601String(),
        'offlineReady': true,
      },
      ttl: const Duration(days: 7),
    );
  }

  Future<void> persistDiagnosticsSnapshot({Map<String, Object?>? coordinator}) async {
    await _cache.write(
      ns: CacheStore.nsDiagnostics,
      id: 'last',
      payload: exportDiagnostics(coordinator: coordinator),
      ttl: const Duration(hours: 24),
    );
  }

  Future<PortfolioSnapshot> loadPortfolio({bool empty = false}) async {
    final syncStarted = DateTime.now();
    _prefs ??= await SharedPreferences.getInstance();
    _syncStatus = SyncStatusSnapshot(
      state: WalletSyncState.syncing,
      lastUpdatedAt: _syncStatus.lastUpdatedAt,
      pendingTransactions: _syncStatus.pendingTransactions,
      offline: _networkManager.offline,
      priceStale: _syncStatus.priceStale,
      endpointIssues: _networkManager.hasDegradedEndpoints,
      fromCache: false,
      failedChains: _failedChains,
      lastSyncReason: _lastSyncReason,
    );

    // Connectivity + market bootstrap + prior portfolio cache in parallel.
    // Tip RPC probes stay off this path (SyncCoordinator warms them later).
    PortfolioSnapshot? prior;
    await Future.wait([
      () async {
        try {
          await _networkManager
              .refresh(probeEndpoints: false)
              .timeout(const Duration(seconds: 6));
        } catch (_) {
          // Keep prior health / offline flags; UI shows degraded banners.
        }
      }(),
      () async {
        try {
          await withRetry(
            () => _priceService.bootstrap(),
            maxAttempts: 2,
            onRetry: (_, __) {
              _diagnostics = _bumpRetries(_diagnostics);
            },
          ).timeout(const Duration(seconds: 10));
        } catch (_) {
          await _priceService.markOfflineFallback();
        }
      }(),
      () async {
        prior = await cachedPortfolio();
      }(),
    ]);

    final wallet = _walletEngine.wallet;
    if (wallet == null || wallet.activeAccount == null || empty) {
      final snap = PortfolioSnapshot(
        assets: const [],
        transactions: const [],
        contacts: const [],
        trend7d: const [0, 0, 0, 0, 0, 0, 0],
        change24hUsd: 0,
        change24hPct: 0,
        updatedAt: DateTime.now(),
        isPreview: true,
        offline: _networkManager.offline,
        priceError: false,
        syncDelayed: _networkManager.hasDegradedEndpoints,
        fromCache: false,
      );
      await _persist(snap);
      _setIdleStatus(snap);
      return snap;
    }

    if (_networkManager.offline) {
      final priorSnap = prior;
      if (priorSnap != null) {
        final offlineSnap = priorSnap.copyWith(
          offline: true,
          syncDelayed: true,
          fromCache: true,
          isPreview: true,
        );
        _setIdleStatus(offlineSnap, state: WalletSyncState.offline);
        return offlineSnap;
      }
    }

    final account = wallet.activeAccount!;
    var rpcRequests = 0;
    var rpcFailures = 0;
    var retries = 0;

    Map<String, PricePoint> quotes;
    try {
      // bootstrap() already refreshed when needed — avoid a second market round-trip.
      quotes = await withRetry(
        () => _priceService.quotes(
          _assetRegistry.all.map((item) => item.symbol),
          forceRefresh: false,
        ),
        maxAttempts: 2,
        onRetry: (_, __) => retries += 1,
      );
    } catch (_) {
      await _priceService.markOfflineFallback();
      quotes = await _priceService.quotes(_assetRegistry.all.map((item) => item.symbol));
    }

    // Independent chains load concurrently (bounded by adapter count, typically 6).
    final chainResults = await Future.wait([
      for (final address in account.addresses)
        _loadChainHoldings(
          address: address,
          quotes: quotes,
          prior: prior,
          onRetry: () => retries += 1,
        ),
    ]);

    final assets = <AssetHolding>[];
    final txs = <PortfolioTx>[];
    final failed = <String>[];
    for (final result in chainResults) {
      rpcRequests += result.rpcRequests;
      rpcFailures += result.rpcFailures;
      if (result.failed) {
        failed.add(result.chainKey);
        assets.addAll(result.assets);
        txs.addAll(result.txs);
      } else {
        assets.addAll(result.assets);
        txs.addAll(result.txs);
      }
    }

    _failedChains = List.unmodifiable(failed);
    // Keep device-local activity (sends/swaps/buys) across successful syncs.
    // Adapter history alone would otherwise wipe preview txs created on-device.
    final priorSnap = prior;
    if (priorSnap != null) {
      final seen = {for (final t in txs) t.id};
      for (final t in priorSnap.transactions) {
        if (seen.add(t.id)) txs.add(t);
      }
    }
    txs.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    final total = assets.fold<double>(0, (sum, item) => sum + item.fiatValue);
    final weighted = assets.fold<double>(0, (sum, item) => sum + (item.change24hPct * item.fiatValue));
    final changePct = total == 0 ? 0.0 : weighted / total;
    final trend = (quotes['BTC']?.sparkline7d ?? const [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])
        .map((v) => v * 0.7)
        .toList();

    final latencyValues = _networkManager.allStatuses.map((item) => item.latencyMs).toList();
    final avgLatency = latencyValues.isEmpty
        ? 0
        : latencyValues.reduce((a, b) => a + b) ~/ latencyValues.length;

    final syncDelayed = _networkManager.hasDegradedEndpoints || failed.isNotEmpty;
    final priceError = quotes.values.any((item) => item.stale);

    final durationMs = DateTime.now().difference(syncStarted).inMilliseconds;
    _diagnostics = WalletDiagnostics(
      cacheHits: _diagnostics.cacheHits,
      cacheMisses: _diagnostics.cacheMisses + 1,
      rpcRequests: _diagnostics.rpcRequests + rpcRequests,
      rpcFailures: _diagnostics.rpcFailures + rpcFailures,
      averageLatencyMs: avgLatency,
      lastSyncAt: DateTime.now(),
      retryAttempts: _diagnostics.retryAttempts + retries,
      partialChainFailures: _diagnostics.partialChainFailures + failed.length,
      coldStartMs: _diagnostics.coldStartMs,
      lastSyncReason: _lastSyncReason,
      lastSyncDurationMs: durationMs,
      syncSampleCount: _diagnostics.syncSampleCount + 1,
      errorEvents: _diagnostics.errorEvents + failed.length,
    );

    final snap = PortfolioSnapshot(
      assets: assets,
      transactions: txs,
      contacts: const [],
      trend7d: trend,
      change24hUsd: total * (changePct / 100),
      change24hPct: changePct,
      updatedAt: DateTime.now(),
      isPreview: true,
      offline: false,
      priceError: priceError,
      syncDelayed: syncDelayed,
      fromCache: false,
      failedChains: _failedChains,
    );
    await _persist(snap);
    await _cache.write(
      ns: CacheStore.nsNetworkMeta,
      id: 'endpoints',
      payload: _networkManager.diagnosticsJson(),
      ttl: const Duration(minutes: 15),
    );
    _setIdleStatus(
      snap,
      state: syncDelayed ? WalletSyncState.degraded : WalletSyncState.idle,
    );
    return snap;
  }

  Future<({
    String chainKey,
    bool failed,
    int rpcRequests,
    int rpcFailures,
    List<AssetHolding> assets,
    List<PortfolioTx> txs,
  })> _loadChainHoldings({
    required WalletAddressRecord address,
    required Map<String, PricePoint> quotes,
    required PortfolioSnapshot? prior,
    required void Function() onRetry,
  }) async {
    final chain = address.chain;
    try {
      final defs = _assetRegistry.forChain(chain);
      final adapter = _blockchainLayer.adapterFor(chain);
      // Balances + history are independent — overlap within the chain.
      late final List<double> balances;
      late final List<PortfolioTx> history;
      await Future.wait([
        () async {
          balances = await Future.wait([
            for (final asset in defs)
              withRetry(
                () => adapter.getBalance(address: address, assetSymbol: asset.symbol),
                maxAttempts: 2,
                onRetry: (_, __) => onRetry(),
              ),
          ]);
        }(),
        () async {
          history = await withRetry(
            () => adapter.getHistory(address: address),
            maxAttempts: 2,
            onRetry: (_, __) => onRetry(),
          );
        }(),
      ]);
      final chainAssets = <AssetHolding>[
        for (var i = 0; i < defs.length; i++)
          AssetHolding(
            id: _assetRegistry.holdingId(defs[i], chain),
            name: defs[i].displayName,
            ticker: defs[i].symbol,
            network: chain.assetNetwork,
            balance: balances[i],
            priceUsd: (quotes[defs[i].symbol] ??
                    PricePoint(
                      symbol: defs[i].symbol,
                      priceUsd: 0,
                      change24hPct: 0,
                      sparkline7d: const [0, 0, 0, 0, 0, 0, 0],
                      updatedAt: DateTime.now(),
                      stale: true,
                    ))
                .priceUsd,
            change24hPct: (quotes[defs[i].symbol]?.change24hPct) ?? 0,
            color: _colorFor(chain),
            sparkline: quotes[defs[i].symbol]?.sparkline7d ?? const [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
          ),
      ];
      await _cache.write(
        ns: CacheStore.nsTxHistory,
        id: chain.key,
        payload: history.map(_txToJson).toList(),
        ttl: const Duration(hours: 6),
      );
      return (
        chainKey: chain.key,
        failed: false,
        rpcRequests: defs.length + 1,
        rpcFailures: 0,
        assets: chainAssets,
        txs: history,
      );
    } catch (_) {
      final fallbackAssets = prior == null
          ? const <AssetHolding>[]
          : prior.assets.where((a) => a.network == chain.assetNetwork).toList();
      final fallbackTxs = prior == null
          ? const <PortfolioTx>[]
          : prior.transactions.where((t) => t.network == chain.assetNetwork).toList();
      return (
        chainKey: chain.key,
        failed: true,
        rpcRequests: 0,
        rpcFailures: 1,
        assets: fallbackAssets,
        txs: fallbackTxs,
      );
    }
  }

  Future<PortfolioSnapshot?> cachedPortfolio() async {
    _prefs ??= await SharedPreferences.getInstance();
    final namespaced = await _cache.read<Map<String, Object?>>(
      ns: CacheStore.nsPortfolio,
      id: 'active',
      decode: (raw) => Map<String, Object?>.from(raw as Map),
      allowStale: true,
    );
    if (namespaced != null) {
      _diagnostics = _copyDiag(cacheHits: _diagnostics.cacheHits + 1);
      return _decodePortfolio(namespaced.data).copyWith(fromCache: true);
    }

    final raw = _prefs?.getString(_kPortfolioCache);
    if (raw == null || raw.isEmpty) {
      _diagnostics = _copyDiag(cacheMisses: _diagnostics.cacheMisses + 1);
      return null;
    }
    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      _diagnostics = _copyDiag(cacheMisses: _diagnostics.cacheMisses + 1);
      return null;
    }
    _diagnostics = _copyDiag(cacheHits: _diagnostics.cacheHits + 1);
    return _decodePortfolio(Map<String, Object?>.from(decoded)).copyWith(fromCache: true);
  }

  Future<void> clearCaches() async {
    await _cache.clearAll();
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs?.remove(_kPortfolioCache);
  }

  Future<int> purgeExpiredCache({bool force = false}) => _cache.purgeExpired(force: force);

  Map<String, Object?> exportDiagnostics({
    Map<String, Object?>? coordinator,
  }) {
    return {
      'generatedAt': DateTime.now().toIso8601String(),
      'preview': true,
      'privacy': 'no_keys_seeds_pins',
      'walletDiagnostics': _diagnostics.toJson(),
      'syncStatus': {
        'state': _syncStatus.state.name,
        'lastUpdatedAt': _syncStatus.lastUpdatedAt.toIso8601String(),
        'pendingTransactions': _syncStatus.pendingTransactions,
        'offline': _syncStatus.offline,
        'priceStale': _syncStatus.priceStale,
        'endpointIssues': _syncStatus.endpointIssues,
        'fromCache': _syncStatus.fromCache,
        'failedChains': _syncStatus.failedChains,
        'lastSyncReason': _syncStatus.lastSyncReason,
      },
      'network': _networkManager.diagnosticsJson(),
      'startupTimingMs': StartupTiming.snapshot(),
      if (coordinator != null) 'coordinator': coordinator,
    };
  }

  Future<Map<String, Object?>> exportDiagnosticsAsync({
    Map<String, Object?>? coordinator,
  }) async {
    final sizes = await _cache.namespaceSizes();
    return {
      ...exportDiagnostics(coordinator: coordinator),
      'cacheNamespaces': sizes,
    };
  }

  /// Public persist for device-local activity recorded outside a full sync.
  Future<void> persistPortfolio(PortfolioSnapshot snap) => _persist(snap);

  Future<void> _persist(PortfolioSnapshot snap) async {
    _prefs ??= await SharedPreferences.getInstance();
    final map = _encodePortfolio(snap);
    final raw = jsonEncode(map);
    await _prefs?.setString(_kPortfolioCache, raw);
    await _cache.write(
      ns: CacheStore.nsPortfolio,
      id: 'active',
      payload: map,
      ttl: const Duration(hours: 12),
    );
    _setIdleStatus(snap);
  }

  void _setIdleStatus(PortfolioSnapshot snap, {WalletSyncState state = WalletSyncState.idle}) {
    final pending = snap.transactions.where((t) => t.status == TxStatus.pending).length;
    _syncStatus = SyncStatusSnapshot(
      state: snap.offline ? WalletSyncState.offline : state,
      lastUpdatedAt: snap.updatedAt,
      pendingTransactions: pending,
      offline: snap.offline,
      priceStale: snap.priceError,
      endpointIssues: snap.syncDelayed,
      fromCache: snap.fromCache,
      failedChains: snap.failedChains,
      lastSyncReason: _lastSyncReason,
    );
  }

  WalletDiagnostics _bumpRetries(WalletDiagnostics d) => _copyDiag(retryAttempts: d.retryAttempts + 1);

  WalletDiagnostics _copyDiag({
    int? cacheHits,
    int? cacheMisses,
    int? rpcRequests,
    int? rpcFailures,
    int? averageLatencyMs,
    DateTime? lastSyncAt,
    int? retryAttempts,
    int? partialChainFailures,
    int? coldStartMs,
    String? lastSyncReason,
    int? lastSyncDurationMs,
    int? syncSampleCount,
    int? errorEvents,
  }) {
    return WalletDiagnostics(
      cacheHits: cacheHits ?? _diagnostics.cacheHits,
      cacheMisses: cacheMisses ?? _diagnostics.cacheMisses,
      rpcRequests: rpcRequests ?? _diagnostics.rpcRequests,
      rpcFailures: rpcFailures ?? _diagnostics.rpcFailures,
      averageLatencyMs: averageLatencyMs ?? _diagnostics.averageLatencyMs,
      lastSyncAt: lastSyncAt ?? _diagnostics.lastSyncAt,
      retryAttempts: retryAttempts ?? _diagnostics.retryAttempts,
      partialChainFailures: partialChainFailures ?? _diagnostics.partialChainFailures,
      coldStartMs: coldStartMs ?? _diagnostics.coldStartMs,
      lastSyncReason: lastSyncReason ?? _diagnostics.lastSyncReason,
      lastSyncDurationMs: lastSyncDurationMs ?? _diagnostics.lastSyncDurationMs,
      syncSampleCount: syncSampleCount ?? _diagnostics.syncSampleCount,
      errorEvents: errorEvents ?? _diagnostics.errorEvents,
    );
  }

  Map<String, Object?> _encodePortfolio(PortfolioSnapshot snap) => {
        'assets': [
          for (final item in snap.assets)
            {
              'id': item.id,
              'name': item.name,
              'ticker': item.ticker,
              'network': item.network.name,
              'balance': item.balance,
              'priceUsd': item.priceUsd,
              'change24hPct': item.change24hPct,
              'color': item.color,
              'sparkline': item.sparkline,
            },
        ],
        'transactions': [for (final tx in snap.transactions) _txToJson(tx)],
        'trend7d': snap.trend7d,
        'change24hUsd': snap.change24hUsd,
        'change24hPct': snap.change24hPct,
        'updatedAt': snap.updatedAt.toIso8601String(),
        'isPreview': snap.isPreview,
        'offline': snap.offline,
        'priceError': snap.priceError,
        'syncDelayed': snap.syncDelayed,
        'failedChains': snap.failedChains,
      };

  Map<String, Object?> _txToJson(PortfolioTx tx) => {
        'id': tx.id,
        'type': tx.type.name,
        'status': tx.status.name,
        'network': tx.network.name,
        'assetTicker': tx.assetTicker,
        'amount': tx.amount,
        'amountUsd': tx.amountUsd,
        'timestamp': tx.timestamp.toIso8601String(),
        'from': tx.from,
        'to': tx.to,
        'hash': tx.hash,
        'fee': tx.fee,
        'feeAsset': tx.feeAsset,
        'note': tx.note,
      };

  PortfolioSnapshot _decodePortfolio(Map<String, Object?> decoded) {
    final assets = ((decoded['assets'] as List<Object?>?) ?? const [])
        .whereType<Map>()
        .map((raw) {
          final json = Map<String, Object?>.from(raw);
          return AssetHolding(
            id: (json['id'] as String?) ?? '',
            name: (json['name'] as String?) ?? '',
            ticker: (json['ticker'] as String?) ?? '',
            network: AssetNetwork.values.firstWhere(
              (value) => value.name == json['network'],
              orElse: () => AssetNetwork.ethereum,
            ),
            balance: (json['balance'] as num?)?.toDouble() ?? 0,
            priceUsd: (json['priceUsd'] as num?)?.toDouble() ?? 0,
            change24hPct: (json['change24hPct'] as num?)?.toDouble() ?? 0,
            color: (json['color'] as num?)?.toInt() ?? 0xFF627EEA,
            sparkline: ((json['sparkline'] as List<Object?>?) ?? const [])
                .map((item) => (item as num).toDouble())
                .toList(),
          );
        })
        .toList();
    final transactions = ((decoded['transactions'] as List<Object?>?) ?? const [])
        .whereType<Map>()
        .map((raw) {
          final json = Map<String, Object?>.from(raw);
          return PortfolioTx(
            id: (json['id'] as String?) ?? '',
            type: TxType.values.firstWhere(
              (value) => value.name == json['type'],
              orElse: () => TxType.receive,
            ),
            status: TxStatus.values.firstWhere(
              (value) => value.name == json['status'],
              orElse: () => TxStatus.pending,
            ),
            network: AssetNetwork.values.firstWhere(
              (value) => value.name == json['network'],
              orElse: () => AssetNetwork.ethereum,
            ),
            assetTicker: (json['assetTicker'] as String?) ?? '',
            amount: (json['amount'] as num?)?.toDouble() ?? 0,
            amountUsd: (json['amountUsd'] as num?)?.toDouble() ?? 0,
            timestamp: DateTime.tryParse((json['timestamp'] as String?) ?? '') ?? DateTime.now(),
            from: (json['from'] as String?) ?? '',
            to: (json['to'] as String?) ?? '',
            hash: (json['hash'] as String?) ?? '',
            fee: (json['fee'] as num?)?.toDouble(),
            feeAsset: json['feeAsset'] as String?,
            note: json['note'] as String?,
          );
        })
        .toList();
    final failed = ((decoded['failedChains'] as List<Object?>?) ?? const [])
        .whereType<String>()
        .toList();
    return PortfolioSnapshot(
      assets: assets,
      transactions: transactions,
      contacts: const [],
      trend7d: ((decoded['trend7d'] as List<Object?>?) ?? const [])
          .map((item) => (item as num).toDouble())
          .toList(),
      change24hUsd: (decoded['change24hUsd'] as num?)?.toDouble() ?? 0,
      change24hPct: (decoded['change24hPct'] as num?)?.toDouble() ?? 0,
      updatedAt: DateTime.tryParse((decoded['updatedAt'] as String?) ?? '') ?? DateTime.now(),
      isPreview: decoded['isPreview'] != false,
      offline: decoded['offline'] == true,
      priceError: decoded['priceError'] == true,
      syncDelayed: decoded['syncDelayed'] == true,
      fromCache: true,
      failedChains: failed,
    );
  }

  int _colorFor(ChainId chain) => switch (chain) {
        ChainId.bitcoin => 0xFFF7931A,
        ChainId.ethereum => 0xFF627EEA,
        ChainId.solana => 0xFF0E8A6A,
        ChainId.bnbSmartChain => 0xFFF3BA2F,
        ChainId.tron => 0xFFE84142,
        ChainId.polygon => 0xFF8247E5,
      };
}
