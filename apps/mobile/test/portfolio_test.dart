import 'package:auvora_wallet/portfolio/portfolio_controller.dart';
import 'package:auvora_wallet/portfolio/portfolio_repository.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('portfolio boots to empty preview state before wallet sync', () async {
    final c = PortfolioController(repository: PortfolioRepository());
    await c.bootstrap('0xabc123');
    expect(c.loading, isFalse);
    expect(c.snapshot, isNotNull);
    expect(c.snapshot!.isPreview, isTrue);
    expect(c.snapshot!.totalUsd, 0);
    expect(c.visibleAssets, isEmpty);
  });

  test('hide balances masks money formatting', () async {
    final c = PortfolioController(repository: PortfolioRepository());
    await c.bootstrap('0xabc123');
    await c.setHideBalances(true);
    expect(c.money(100), '••••••');
    expect(c.crypto(1.2, 'ETH'), '•••• ETH');
  });

  test('search finds locally applied assets and pending transactions', () async {
    final c = PortfolioController(repository: PortfolioRepository());
    await c.bootstrap('0xabc123');
    c.applyLocalSnapshot(
      assets: const [
        AssetHolding(
          id: 'eth',
          name: 'Ethereum',
          ticker: 'ETH',
          network: AssetNetwork.ethereum,
          balance: 1.25,
          priceUsd: 3200,
          change24hPct: 1.2,
          color: 0xFF627EEA,
          sparkline: [1, 2, 3],
        ),
      ],
      prependTx: PortfolioTx(
        id: 'tx1',
        type: TxType.send,
        status: TxStatus.pending,
        network: AssetNetwork.ethereum,
        assetTicker: 'ETH',
        amount: 0.1,
        amountUsd: 320,
        timestamp: DateTime.now(),
        from: '0xfrom',
        to: '0xto',
        hash: '0xhash',
      ),
    );
    c.setGlobalQuery('eth');
    expect(c.searchResults, isNotEmpty);
    c.setGlobalQuery('pending');
    expect(c.searchResults, isNotEmpty);
  });

  test('empty mode yields zero non-zero holdings', () async {
    final c = PortfolioController(repository: PortfolioRepository());
    await c.setEmptyMode(true);
    await c.bootstrap('0xabc123');
    expect(c.isEmptyPortfolio, isTrue);
  });
}
