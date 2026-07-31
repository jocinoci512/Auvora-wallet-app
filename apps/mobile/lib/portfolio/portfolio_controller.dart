import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';
import 'portfolio_repository.dart';

enum AssetSort { valueDesc, nameAsc, changeDesc, balanceDesc }

class PortfolioController extends ChangeNotifier {
  PortfolioController({PortfolioRepository? repository}) : _repo = repository ?? PortfolioRepository();

  PortfolioRepository _repo;

  static const _kHideBalances = 'auvora_hide_balances_v1';
  static const _kHideZero = 'auvora_hide_zero_v1';
  static const _kFavorites = 'auvora_favorites_v1';
  static const _kPinned = 'auvora_pinned_v1';
  static const _kSort = 'auvora_asset_sort_v1';
  static const _kEmptyMode = 'auvora_empty_portfolio_v1';

  PortfolioSnapshot? snapshot;
  bool loading = true;
  bool refreshing = false;
  bool hideBalances = false;
  bool hideZeroBalances = false;
  bool emptyMode = false;
  Set<String> favorites = {};
  Set<String> pinned = {};
  AssetSort sort = AssetSort.valueDesc;
  String assetQuery = '';
  String globalQuery = '';
  String activityQuery = '';
  TxStatus? activityStatusFilter;
  TxType? activityTypeFilter;
  AssetNetwork? activityNetworkFilter;

  void attachRepository(PortfolioRepository repository) {
    if (identical(_repo, repository)) return;
    _repo = repository;
  }

  Future<void> bootstrap(String? address) async {
    final prefs = await SharedPreferences.getInstance();
    hideBalances = prefs.getBool(_kHideBalances) ?? false;
    hideZeroBalances = prefs.getBool(_kHideZero) ?? false;
    emptyMode = prefs.getBool(_kEmptyMode) ?? false;
    favorites = (prefs.getStringList(_kFavorites) ?? []).toSet();
    pinned = (prefs.getStringList(_kPinned) ?? []).toSet();
    final sortName = prefs.getString(_kSort);
    sort = AssetSort.values.firstWhere(
      (s) => s.name == sortName,
      orElse: () => AssetSort.valueDesc,
    );

    // Cache-first paint — never block the first frame on RPC.
    final cached = await _repo.loadCached();
    if (cached != null) {
      snapshot = cached;
      loading = false;
      notifyListeners();
    } else {
      loading = true;
      notifyListeners();
    }
    await refresh(address, soft: snapshot != null);
  }

  /// [soft] keeps existing holdings visible while a background sync runs.
  Future<void> refresh(String? address, {bool soft = false}) async {
    if (!soft || snapshot == null) {
      loading = true;
    }
    refreshing = true;
    notifyListeners();
    try {
      snapshot = await _repo.load(walletAddress: address, empty: emptyMode);
    } finally {
      loading = false;
      refreshing = false;
      notifyListeners();
    }
  }

  Future<void> setHideBalances(bool value) async {
    hideBalances = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kHideBalances, value);
    notifyListeners();
  }

  Future<void> setHideZero(bool value) async {
    hideZeroBalances = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kHideZero, value);
    notifyListeners();
  }

  Future<void> setEmptyMode(bool value) async {
    emptyMode = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kEmptyMode, value);
    notifyListeners();
  }

  Future<void> setSort(AssetSort value) async {
    sort = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kSort, value.name);
    notifyListeners();
  }

  void setAssetQuery(String q) {
    assetQuery = q;
    notifyListeners();
  }

  void setGlobalQuery(String q) {
    globalQuery = q;
    notifyListeners();
  }

  void setActivityQuery(String q) {
    activityQuery = q;
    notifyListeners();
  }

  void setActivityStatusFilter(TxStatus? status) {
    activityStatusFilter = status;
    notifyListeners();
  }

  void setActivityTypeFilter(TxType? type) {
    activityTypeFilter = type;
    notifyListeners();
  }

  void setActivityNetworkFilter(AssetNetwork? network) {
    activityNetworkFilter = network;
    notifyListeners();
  }

  void clearActivityFilters() {
    activityQuery = '';
    activityStatusFilter = null;
    activityTypeFilter = null;
    activityNetworkFilter = null;
    notifyListeners();
  }

  /// Fiat share of each non-zero holding for allocation UI.
  List<({AssetHolding asset, double pct})> get allocationSlices {
    final assets = snapshot?.nonZero ?? const <AssetHolding>[];
    final total = assets.fold<double>(0, (sum, a) => sum + a.fiatValue);
    if (total <= 0) return const [];
    return [
      for (final asset in assets)
        (asset: asset, pct: (asset.fiatValue / total) * 100),
    ]..sort((a, b) => b.pct.compareTo(a.pct));
  }

  List<PortfolioTx> get filteredTransactions {
    final txs = [...(snapshot?.transactions ?? const <PortfolioTx>[])];
    final q = activityQuery.trim().toLowerCase();
    return txs.where((tx) {
      if (activityStatusFilter != null && tx.status != activityStatusFilter) return false;
      if (activityTypeFilter != null && tx.type != activityTypeFilter) return false;
      if (activityNetworkFilter != null && tx.network != activityNetworkFilter) return false;
      if (q.isEmpty) return true;
      return tx.assetTicker.toLowerCase().contains(q) ||
          tx.hash.toLowerCase().contains(q) ||
          tx.from.toLowerCase().contains(q) ||
          tx.to.toLowerCase().contains(q) ||
          tx.type.label.toLowerCase().contains(q) ||
          tx.status.label.toLowerCase().contains(q) ||
          tx.network.label.toLowerCase().contains(q) ||
          (tx.note?.toLowerCase().contains(q) ?? false);
    }).toList()
      ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
  }

  Future<void> toggleFavorite(String id) async {
    if (favorites.contains(id)) {
      favorites.remove(id);
    } else {
      favorites.add(id);
    }
    favorites = {...favorites};
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_kFavorites, favorites.toList());
    notifyListeners();
  }

  Future<void> togglePinned(String id) async {
    if (pinned.contains(id)) {
      pinned.remove(id);
    } else {
      pinned.add(id);
    }
    pinned = {...pinned};
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_kPinned, pinned.toList());
    notifyListeners();
  }

  String mask(String value) => hideBalances ? '••••••' : value;

  String money(double v, {int digits = 2}) {
    if (hideBalances) return '••••••';
    final fixed = v.toStringAsFixed(digits);
    final parts = fixed.split('.');
    final whole = parts[0].replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
      (m) => '${m[1]},',
    );
    return '\$$whole.${parts[1]}';
  }

  String crypto(double v, String ticker, {int digits = 4}) {
    if (hideBalances) return '•••• $ticker';
    final s = v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(digits);
    return '$s $ticker';
  }

  List<AssetHolding> get visibleAssets {
    final snap = snapshot;
    if (snap == null) return const [];
    var list = [...snap.assets];
    if (hideZeroBalances) {
      list = list.where((a) => a.balance > 0).toList();
    }
    final q = assetQuery.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list
          .where(
            (a) =>
                a.name.toLowerCase().contains(q) ||
                a.ticker.toLowerCase().contains(q) ||
                a.network.label.toLowerCase().contains(q),
          )
          .toList();
    }
    list.sort((a, b) {
      final ap = pinned.contains(a.id) ? 0 : 1;
      final bp = pinned.contains(b.id) ? 0 : 1;
      if (ap != bp) return ap.compareTo(bp);
      final af = favorites.contains(a.id) ? 0 : 1;
      final bf = favorites.contains(b.id) ? 0 : 1;
      if (af != bf) return af.compareTo(bf);
      switch (sort) {
        case AssetSort.valueDesc:
          return b.fiatValue.compareTo(a.fiatValue);
        case AssetSort.nameAsc:
          return a.name.compareTo(b.name);
        case AssetSort.changeDesc:
          return b.change24hPct.compareTo(a.change24hPct);
        case AssetSort.balanceDesc:
          return b.balance.compareTo(a.balance);
      }
    });
    return list;
  }

  bool get isEmptyPortfolio {
    final snap = snapshot;
    if (snap == null) return true;
    return snap.nonZero.isEmpty;
  }

  AssetHolding? assetById(String id) {
    final list = snapshot?.assets;
    if (list == null) return null;
    for (final a in list) {
      if (a.id == id) return a;
    }
    return null;
  }

  PortfolioTx? txById(String id) {
    final list = snapshot?.transactions;
    if (list == null) return null;
    for (final t in list) {
      if (t.id == id) return t;
    }
    return null;
  }

  /// Records an outgoing transfer locally and deducts available balance.
  Future<PortfolioTx> recordOutgoingSend({
    required AssetHolding asset,
    required String to,
    required String from,
    required double amount,
    required double feeCrypto,
    required String feeAsset,
  }) async {
    final snap = snapshot;
    if (snap == null) {
      throw StateError('Portfolio not loaded');
    }
    final id = 'local-${DateTime.now().millisecondsSinceEpoch}';
    final hash =
        '0x${id.hashCode.toRadixString(16).padLeft(8, '0')}${amount.hashCode.toRadixString(16).padLeft(8, '0')}${to.hashCode.abs().toRadixString(16)}';
    final tx = PortfolioTx(
      id: id,
      type: TxType.send,
      status: TxStatus.pending,
      network: asset.network,
      assetTicker: asset.ticker,
      amount: amount,
      amountUsd: amount * asset.priceUsd,
      timestamp: DateTime.now(),
      from: from,
      to: to,
      hash: hash,
      fee: feeCrypto,
      feeAsset: feeAsset,
      note: 'Submitted from this device',
    );

    final assets = snap.assets.map((a) {
      if (a.id != asset.id) return a;
      return a.copyWith(balance: (a.balance - amount).clamp(0, double.infinity));
    }).toList();

    snapshot = PortfolioSnapshot(
      assets: assets,
      transactions: [tx, ...snap.transactions],
      contacts: snap.contacts,
      trend7d: snap.trend7d,
      change24hUsd: snap.change24hUsd,
      change24hPct: snap.change24hPct,
      updatedAt: DateTime.now(),
      isPreview: snap.isPreview,
      offline: snap.offline,
      priceError: snap.priceError,
      syncDelayed: snap.syncDelayed,
    );
    notifyListeners();

    // Settle pending → completed after a short confirmation window.
    Future<void>.delayed(const Duration(seconds: 3), () {
      finalizeTxStatus(id, TxStatus.completed);
    });
    return tx;
  }

  void finalizeTxStatus(String id, TxStatus status) {
    final snap = snapshot;
    if (snap == null) return;
    final txs = snap.transactions.map((t) {
      if (t.id != id) return t;
      return PortfolioTx(
        id: t.id,
        type: t.type,
        status: status,
        network: t.network,
        assetTicker: t.assetTicker,
        amount: t.amount,
        amountUsd: t.amountUsd,
        timestamp: t.timestamp,
        from: t.from,
        to: t.to,
        hash: t.hash,
        fee: t.fee,
        feeAsset: t.feeAsset,
        note: t.note,
      );
    }).toList();
    snapshot = PortfolioSnapshot(
      assets: snap.assets,
      transactions: txs,
      contacts: snap.contacts,
      trend7d: snap.trend7d,
      change24hUsd: snap.change24hUsd,
      change24hPct: snap.change24hPct,
      updatedAt: DateTime.now(),
      isPreview: snap.isPreview,
      offline: snap.offline,
      priceError: snap.priceError,
      syncDelayed: snap.syncDelayed,
    );
    notifyListeners();
  }

  void applyLocalSnapshot({
    required List<AssetHolding> assets,
    required PortfolioTx prependTx,
  }) {
    final snap = snapshot;
    if (snap == null) return;
    snapshot = PortfolioSnapshot(
      assets: assets,
      transactions: [prependTx, ...snap.transactions],
      contacts: snap.contacts,
      trend7d: snap.trend7d,
      change24hUsd: snap.change24hUsd,
      change24hPct: snap.change24hPct,
      updatedAt: DateTime.now(),
      isPreview: snap.isPreview,
      offline: snap.offline,
      priceError: snap.priceError,
      syncDelayed: snap.syncDelayed,
    );
    notifyListeners();
  }

  List<Object> get searchResults {
    final snap = snapshot;
    if (snap == null) return const [];
    final q = globalQuery.trim().toLowerCase();
    if (q.isEmpty) return const [];
    final out = <Object>[];
    for (final a in snap.assets) {
      if (a.name.toLowerCase().contains(q) || a.ticker.toLowerCase().contains(q)) {
        out.add(a);
      }
    }
    for (final n in AssetNetwork.values) {
      if (n.label.toLowerCase().contains(q) || n.short.toLowerCase().contains(q)) {
        out.add(n);
      }
    }
    for (final t in snap.transactions) {
      if (t.assetTicker.toLowerCase().contains(q) ||
          t.hash.toLowerCase().contains(q) ||
          t.type.label.toLowerCase().contains(q) ||
          t.status.label.toLowerCase().contains(q)) {
        out.add(t);
      }
    }
    for (final c in snap.contacts) {
      if (c.name.toLowerCase().contains(q) || c.address.toLowerCase().contains(q)) {
        out.add(c);
      }
    }
    return out;
  }
}
