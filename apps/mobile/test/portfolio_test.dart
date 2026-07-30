import 'package:auvora_wallet/portfolio/portfolio_controller.dart';
import 'package:auvora_wallet/portfolio/portfolio_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('portfolio loads preview holdings and totals', () async {
    final c = PortfolioController(repository: PortfolioRepository());
    await c.bootstrap('0xabc123');
    expect(c.loading, isFalse);
    expect(c.snapshot, isNotNull);
    expect(c.snapshot!.isPreview, isTrue);
    expect(c.snapshot!.totalUsd, greaterThan(0));
    expect(c.visibleAssets, isNotEmpty);
  });

  test('hide balances masks money formatting', () async {
    final c = PortfolioController(repository: PortfolioRepository());
    await c.bootstrap('0xabc123');
    await c.setHideBalances(true);
    expect(c.money(100), '••••••');
    expect(c.crypto(1.2, 'ETH'), '•••• ETH');
  });

  test('search finds assets and pending transactions', () async {
    final c = PortfolioController(repository: PortfolioRepository());
    await c.bootstrap('0xabc123');
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
