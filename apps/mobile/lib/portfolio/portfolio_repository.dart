import 'models.dart';
import '../wallet_engine/sync_engine.dart';

/// Local portfolio source until live chain + price APIs are wired (Sprint 3+).
class PortfolioRepository {
  PortfolioRepository({SyncEngine? syncEngine}) : _syncEngine = syncEngine;

  SyncEngine? _syncEngine;

  void updateServices({
    required SyncEngine syncEngine,
  }) {
    _syncEngine = syncEngine;
  }

  Future<PortfolioSnapshot> load({required String? walletAddress, bool empty = false}) async {
    final sync = _syncEngine;
    if (sync != null) {
      final snap = await sync.loadPortfolio(empty: empty);
      return PortfolioSnapshot(
        assets: snap.assets,
        transactions: snap.transactions,
        contacts: _contacts,
        trend7d: snap.trend7d,
        change24hUsd: snap.change24hUsd,
        change24hPct: snap.change24hPct,
        updatedAt: snap.updatedAt,
        isPreview: true,
        offline: snap.offline,
        priceError: snap.priceError,
        syncDelayed: snap.syncDelayed,
      );
    }
    await Future<void>.delayed(const Duration(milliseconds: 280));
    return PortfolioSnapshot(
      assets: const [],
      transactions: const [],
      contacts: _contacts,
      trend7d: const [0, 0, 0, 0, 0, 0, 0],
      change24hUsd: 0,
      change24hPct: 0,
      updatedAt: DateTime.now(),
      isPreview: true,
    );
  }

  static const _contacts = [
    AddressContact(
      id: 'c1',
      name: 'Exchange deposit',
      address: '0x8f3a21b9c4d5e6f708192a3b4c5d6e7f8191c2',
      network: AssetNetwork.ethereum,
    ),
    AddressContact(
      id: 'c2',
      name: 'Savings cold',
      address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      network: AssetNetwork.bitcoin,
    ),
  ];
}
