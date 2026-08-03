import 'package:auvora_wallet/connections/wallet_connect_bootstrap.dart';
import 'package:auvora_wallet/release/release_config.dart';
import 'package:auvora_wallet/wallet_engine/market_data_provider.dart';
import 'package:auvora_wallet/wallet_engine/models.dart';
import 'package:auvora_wallet/wallet_engine/price_service.dart';
import 'package:auvora_wallet/wallet_engine/seeded_market_data_provider.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('previewShell is synchronous and never claims live relay', () {
    final shell = WalletConnectBootstrap.previewShell(projectId: '');
    expect(shell.usingLiveRelay, isFalse);
    expect(shell.liveInitAttempted, isFalse);
    expect(shell.provider.isLiveRelay, isFalse);
  });

  test('previewShell defers when project id looks configured', () {
    final shell = WalletConnectBootstrap.previewShell(
      projectId: 'abcdef0123456789abcdef0123456789',
    );
    expect(shell.liveInitDeferred, isTrue);
    expect(shell.usingLiveRelay, isFalse);
    expect(shell.fallbackReason, contains('deferred'));
  });

  test('release kill switches remain locked', () {
    expect(ReleaseConfig.liveBroadcastEnabled, isFalse);
    expect(ReleaseConfig.allowFundingAddresses, isFalse);
  });

  test('price quotes batch maps from warm cache without forceRefresh', () async {
    final service = PriceService(providers: [SeededMarketDataProvider()]);
    await service.bootstrap();
    final quotes = await service.quotes(const ['BTC', 'ETH', 'SOL'], forceRefresh: false);
    expect(quotes.keys, containsAll(['BTC', 'ETH', 'SOL']));
    expect(quotes['BTC']!.priceUsd, greaterThan(0));
    expect(quotes['ETH']!.priceUsd, greaterThan(0));
  });

  test('warm non-seed cache skips live provider on bootstrap', () async {
    final now = DateTime.now();
    final counter = _CountingProvider();
    // Seed SharedPreferences with a fresh coingecko-shaped cache.
    SharedPreferences.setMockInitialValues({
      'auvora_price_cache_v1': '''
{
  "BTC": {
    "symbol": "BTC",
    "priceUsd": 64000,
    "change24hPct": 1.0,
    "sparkline7d": [1,1,1,1,1,1,1],
    "updatedAt": "${now.toIso8601String()}",
    "stale": false,
    "providerId": "coingecko"
  },
  "ETH": {
    "symbol": "ETH",
    "priceUsd": 3200,
    "change24hPct": 1.0,
    "sparkline7d": [1,1,1,1,1,1,1],
    "updatedAt": "${now.toIso8601String()}",
    "stale": false,
    "providerId": "coingecko"
  }
}
''',
    });
    final service = PriceService(providers: [counter, SeededMarketDataProvider()]);
    await service.bootstrap();
    expect(counter.fetchCount, 0);
    expect(service.activeProviderId, anyOf('coingecko', 'cached'));
    final quotes = await service.quotes(const ['BTC', 'ETH'], forceRefresh: false);
    expect(counter.fetchCount, 0);
    expect(quotes['BTC']!.priceUsd, 64000);
  });
}

class _CountingProvider implements MarketDataProvider {
  int fetchCount = 0;

  @override
  String get id => 'counting-live';

  @override
  Future<Map<String, PricePoint>> fetchQuotes(Iterable<String> symbols) async {
    fetchCount += 1;
    return {
      for (final s in symbols)
        s: PricePoint(
          symbol: s,
          priceUsd: 1,
          change24hPct: 0,
          sparkline7d: const [1, 1, 1, 1, 1, 1, 1],
          updatedAt: DateTime.now(),
        ),
    };
  }

  @override
  Future<List<double>> fetchHistory(String symbol, ChartRange range) async =>
      const [1, 1, 1, 1, 1, 1, 1];
}
