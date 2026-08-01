import 'package:auvora_wallet/portfolio/portfolio_controller.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('mergeDeviceActivity preserves prior txs without wiping', () {
    final previous = PortfolioSnapshot(
      assets: const [],
      transactions: [
        PortfolioTx(
          id: 'local-1',
          type: TxType.send,
          status: TxStatus.completed,
          network: AssetNetwork.ethereum,
          assetTicker: 'ETH',
          amount: 0.1,
          amountUsd: 300,
          timestamp: DateTime.utc(2026, 1, 1),
          from: 'a',
          to: 'b',
          hash: '0xlocal',
        ),
      ],
      contacts: const [],
      trend7d: const [0, 0, 0, 0, 0, 0, 0],
      change24hUsd: 0,
      change24hPct: 0,
      updatedAt: DateTime.utc(2026, 1, 1),
      isPreview: true,
    );
    final loaded = PortfolioSnapshot(
      assets: const [],
      transactions: [
        PortfolioTx(
          id: 'remote-1',
          type: TxType.receive,
          status: TxStatus.completed,
          network: AssetNetwork.ethereum,
          assetTicker: 'ETH',
          amount: 0.2,
          amountUsd: 600,
          timestamp: DateTime.utc(2026, 1, 2),
          from: 'c',
          to: 'd',
          hash: '0xremote',
        ),
      ],
      contacts: const [],
      trend7d: const [0, 0, 0, 0, 0, 0, 0],
      change24hUsd: 0,
      change24hPct: 0,
      updatedAt: DateTime.utc(2026, 1, 2),
      isPreview: true,
    );

    final merged = PortfolioController.mergeDeviceActivity(loaded, previous: previous);
    expect(merged.transactions.map((t) => t.id), containsAll(['local-1', 'remote-1']));
  });
}
