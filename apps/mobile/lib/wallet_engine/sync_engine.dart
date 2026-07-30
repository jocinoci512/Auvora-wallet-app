import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../portfolio/models.dart';
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
  })  : _walletEngine = walletEngine,
        _blockchainLayer = blockchainLayer,
        _assetRegistry = assetRegistry,
        _priceService = priceService,
        _networkManager = networkManager,
        _prefs = prefs;

  final WalletEngine _walletEngine;
  final BlockchainLayer _blockchainLayer;
  final AssetRegistry _assetRegistry;
  final PriceService _priceService;
  final NetworkManager _networkManager;
  SharedPreferences? _prefs;

  WalletDiagnostics _diagnostics = const WalletDiagnostics(
    cacheHits: 0,
    cacheMisses: 0,
    rpcRequests: 0,
    rpcFailures: 0,
    averageLatencyMs: 0,
    lastSyncAt: null,
  );

  static const _kPortfolioCache = 'auvora_portfolio_cache_v2';

  WalletDiagnostics get diagnostics => _diagnostics;

  Future<PortfolioSnapshot> loadPortfolio({bool empty = false}) async {
    _prefs ??= await SharedPreferences.getInstance();
    await _networkManager.refresh();
    await _priceService.bootstrap();
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
      );
      await _persist(snap);
      return snap;
    }

    if (_networkManager.offline) {
      final cached = await cachedPortfolio();
      if (cached != null) {
        _diagnostics = WalletDiagnostics(
          cacheHits: _diagnostics.cacheHits + 1,
          cacheMisses: _diagnostics.cacheMisses,
          rpcRequests: _diagnostics.rpcRequests,
          rpcFailures: _diagnostics.rpcFailures,
          averageLatencyMs: _diagnostics.averageLatencyMs,
          lastSyncAt: _diagnostics.lastSyncAt,
        );
        return PortfolioSnapshot(
          assets: cached.assets,
          transactions: cached.transactions,
          contacts: cached.contacts,
          trend7d: cached.trend7d,
          change24hUsd: cached.change24hUsd,
          change24hPct: cached.change24hPct,
          updatedAt: cached.updatedAt,
          isPreview: true,
          offline: true,
          priceError: cached.priceError,
          syncDelayed: true,
        );
      }
    }

    final account = wallet.activeAccount!;
    final assets = <AssetHolding>[];
    final txs = <PortfolioTx>[];

    final quotes = await _priceService.quotes(_assetRegistry.all.map((item) => item.symbol));
    final results = await Future.wait(
      account.addresses.map((address) async {
        final chain = address.chain;
        final defs = _assetRegistry.forChain(chain);
        final adapter = _blockchainLayer.adapterFor(chain);
        final chainAssets = await Future.wait(
          defs.map((asset) async {
            final quote = quotes[asset.symbol]!;
            final balance = await adapter.getBalance(address: address, assetSymbol: asset.symbol);
            return AssetHolding(
              id: _assetRegistry.holdingId(asset, chain),
              name: asset.displayName,
              ticker: asset.symbol,
              network: chain.assetNetwork,
              balance: balance,
              priceUsd: quote.priceUsd,
              change24hPct: quote.change24hPct,
              color: _colorFor(chain),
              sparkline: quote.sparkline7d,
            );
          }),
        );
        final history = await adapter.getHistory(address: address);
        return (assets: chainAssets, history: history);
      }),
    );
    for (final result in results) {
      assets.addAll(result.assets);
      txs.addAll(result.history);
    }

    txs.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    final total = assets.fold<double>(0, (sum, item) => sum + item.fiatValue);
    final weighted = assets.fold<double>(0, (sum, item) => sum + (item.change24hPct * item.fiatValue));
    final changePct = total == 0 ? 0 : weighted / total;
    final trend = (quotes['BTC']?.sparkline7d ?? const [0, 0, 0, 0, 0, 0, 0]).map((v) => v * 0.7).toList();

    final latencyValues = _networkManager.allStatuses.map((item) => item.latencyMs).toList();
    final avgLatency = latencyValues.isEmpty
        ? 0
        : latencyValues.reduce((a, b) => a + b) ~/ latencyValues.length;
    _diagnostics = WalletDiagnostics(
      cacheHits: _diagnostics.cacheHits,
      cacheMisses: _diagnostics.cacheMisses + 1,
      rpcRequests: _diagnostics.rpcRequests + assets.length + txs.length,
      rpcFailures: _networkManager.hasDegradedEndpoints ? _diagnostics.rpcFailures + 1 : _diagnostics.rpcFailures,
      averageLatencyMs: avgLatency,
      lastSyncAt: DateTime.now(),
    );

    final snap = PortfolioSnapshot(
      assets: assets,
      transactions: txs,
      contacts: const [],
      trend7d: trend,
      change24hUsd: total * (changePct / 100),
      change24hPct: changePct.toDouble(),
      updatedAt: DateTime.now(),
      isPreview: true,
      offline: false,
      priceError: quotes.values.any((item) => item.stale),
      syncDelayed: _networkManager.hasDegradedEndpoints,
    );
    await _persist(snap);
    return snap;
  }

  Future<PortfolioSnapshot?> cachedPortfolio() async {
    _prefs ??= await SharedPreferences.getInstance();
    final raw = _prefs?.getString(_kPortfolioCache);
    if (raw == null || raw.isEmpty) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! Map<String, Object?>) return null;
    final assets = ((decoded['assets'] as List<Object?>?) ?? const [])
        .whereType<Map<String, Object?>>()
        .map((json) => AssetHolding(
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
            ))
        .toList();
    final transactions = ((decoded['transactions'] as List<Object?>?) ?? const [])
        .whereType<Map<String, Object?>>()
        .map((json) => PortfolioTx(
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
            ))
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
    );
  }

  Future<void> _persist(PortfolioSnapshot snap) async {
    _prefs ??= await SharedPreferences.getInstance();
    final raw = jsonEncode({
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
      'transactions': [
        for (final tx in snap.transactions)
          {
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
          },
      ],
      'trend7d': snap.trend7d,
      'change24hUsd': snap.change24hUsd,
      'change24hPct': snap.change24hPct,
      'updatedAt': snap.updatedAt.toIso8601String(),
      'isPreview': snap.isPreview,
      'offline': snap.offline,
      'priceError': snap.priceError,
      'syncDelayed': snap.syncDelayed,
    });
    await _prefs?.setString(_kPortfolioCache, raw);
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
