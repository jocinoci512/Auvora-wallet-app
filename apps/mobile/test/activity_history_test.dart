import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/portfolio/portfolio_controller.dart';
import 'package:flutter_test/flutter_test.dart';

PortfolioTx _tx({
  required String id,
  TxType type = TxType.send,
  DateTime? timestamp,
}) {
  return PortfolioTx(
    id: id,
    type: type,
    status: TxStatus.pending,
    network: AssetNetwork.ethereum,
    assetTicker: 'ETH',
    amount: 0.1,
    amountUsd: 300,
    timestamp: timestamp ?? DateTime.now(),
    from: '0xfrom',
    to: '0xto',
    hash: '0x$id',
    note: 'Preview · on-device',
  );
}

PortfolioSnapshot _snap(List<PortfolioTx> txs) {
  return PortfolioSnapshot(
    assets: const [],
    transactions: txs,
    contacts: const [],
    trend7d: const [0, 0, 0, 0, 0, 0, 0],
    change24hUsd: 0,
    change24hPct: 0,
    updatedAt: DateTime.now(),
    isPreview: true,
  );
}

void main() {
  test('mergeDeviceActivity keeps local txs that adapters omit', () {
    final local = _tx(id: 'preview-send-1', timestamp: DateTime.now());
    final seeded = _tx(
      id: 'ethereum-rx',
      type: TxType.receive,
      timestamp: DateTime.now().subtract(const Duration(hours: 1)),
    );
    final previous = _snap([local, seeded]);
    final loaded = _snap([
      _tx(
        id: 'ethereum-rx',
        type: TxType.receive,
        timestamp: DateTime.now().subtract(const Duration(hours: 1)),
      ),
    ]);

    final merged = PortfolioController.mergeDeviceActivity(loaded, previous: previous);
    expect(merged.transactions.map((t) => t.id), containsAll(['preview-send-1', 'ethereum-rx']));
    expect(merged.transactions.where((t) => t.id == 'preview-send-1').length, 1);
  });

  test('mergeDeviceActivity is a no-op when previous is empty', () {
    final loaded = _snap([_tx(id: 'ethereum-rx', type: TxType.receive)]);
    final merged = PortfolioController.mergeDeviceActivity(loaded, previous: null);
    expect(identical(merged, loaded) || merged.transactions.length == 1, isTrue);
    expect(merged.transactions.single.id, 'ethereum-rx');
  });

  test('applyLocalSnapshot prepends and survives null snapshot bootstrap', () async {
    final c = PortfolioController();
    expect(c.snapshot, isNull);
    final tx = _tx(id: 'eng-tx-abc');
    await c.applyLocalSnapshot(assets: const [], prependTx: tx);
    expect(c.snapshot, isNotNull);
    expect(c.filteredTransactions.first.id, 'eng-tx-abc');
  });
}
